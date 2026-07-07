// Feature: Personal Stats — observes user actions in Beekeeper and increments
// local counters via core/stats-tracker.js. All data stays in chrome.storage.local.

(function () {
  const SETTINGS_KEY = "feature.personalStats";

  // Late-bound lookup: avoid capturing window.BeePlus.stats at IIFE eval time
  // (script order in the manifest usually loads stats-tracker.js first, but the
  // feature registry may init lazily and the reference should be resolved late).
  const bump = (k) => {
    const s = window.BeePlus && window.BeePlus.stats;
    if (s && s.bump) s.bump(k);
  };

  let reactionClickHandler = null;
  let detachClick = null; // shadow-crossing click listener detach
  let observerStop = null;
  let attachScheduled = false;
  let attachRafId = 0;
  // Map<composerElement, handler> — need explicit references so teardown can
  // actually detach the keydown listener. WeakSet lost the handler and every
  // toggle-off/on cycle added a fresh listener → messageSent double-counted.
  let composerHandlers = new Map();
  // De-dup window: Enter-keydown fires messageSent, and Beekeeper often also
  // dispatches a send-button click after the Enter — without this guard every
  // Enter-sent message counts twice.
  let lastSendAt = 0;
  const SEND_DEDUP_MS = 800;

  // Lenient: any textarea/contenteditable in lower viewport.
  // Shadow-piercing so Beekeeper's Web-Components composer is included.
  function findAllComposers() {
    const dom = window.BeePlus.dom;
    const all = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll('textarea, [contenteditable="true"]')
      : [...document.querySelectorAll('textarea, [contenteditable="true"]')];
    return all.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 100 && r.height > 20 && r.bottom > window.innerHeight * 0.4;
    });
  }

  function attachAllComposers() {
    const fresh = findAllComposers();
    const freshSet = new Set(fresh);
    // Prune dead entries — Beekeeper's SPA destroys and recreates composer
    // elements when the user switches chats. Without pruning, the strong
    // Map holds detached DOM subtrees + their handlers alive forever.
    for (const [el, handler] of composerHandlers) {
      const stillLive = freshSet.has(el) || (el.isConnected !== undefined ? el.isConnected : true);
      if (!stillLive) {
        try { el.removeEventListener("keydown", handler, true); } catch (_) {}
        composerHandlers.delete(el);
      }
    }
    for (const ta of fresh) {
      if (composerHandlers.has(ta)) continue;
      const handler = (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          const txt = (ta.value || ta.textContent || "").trim();
          if (!txt) return;
          const now = Date.now();
          if (now - lastSendAt < SEND_DEDUP_MS) return;
          lastSendAt = now;
          bump("messageSent");
          console.log("[BeePlus stats] message sent (Enter)");
        }
      };
      ta.addEventListener("keydown", handler, true);
      composerHandlers.set(ta, handler);
    }
  }

  // Send/reaction detection with tighter regexes anchored on word boundaries.
  // The old broad regex matched "sender", "sendable", "resend-indicator",
  // "reactive" etc. Now we require aria-label / data-bkpr-id as the primary
  // signal and className/title only as a weak backup.
  const SEND_PRIMARY_RE = /(^|[\s_-])(send-button|send-message|send$|submit-button|absenden|abschicken)/i;
  const SEND_LABEL_RE = /\b(send|submit|absenden|abschicken)\b/i;
  const REACTION_PRIMARY_RE = /(^|[\s_-])(reaction|reaction-button|emoji-picker|react-btn|emoji-button)/i;
  const REACTION_LABEL_RE = /\b(reaction|react|emoji)\b/i;

  // Catch send-button clicks too (for users who click instead of pressing Enter).
  // event.target is retargeted to the shadow-host when the true click target
  // is inside a Web-Component; walk composedPath to find the actual button.
  function onAnyClick(e) {
    const dom = window.BeePlus.dom;
    const btnMatch = (el) =>
      el.nodeType === 1 && el.matches && (el.matches("button") || el.getAttribute("role") === "button");
    let btn = null;
    if (dom && dom.findInPath) {
      btn = dom.findInPath(e, btnMatch);
    }
    if (!btn) {
      btn = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;
    }
    if (!btn) return;
    const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
    const title = (btn.getAttribute("title") || "").toLowerCase();
    const bkprId = (btn.getAttribute("data-bkpr-id") || "").toLowerCase();
    const cls = (btn.className || "").toString().toLowerCase();
    const id = (btn.id || "").toLowerCase();
    const primaryBlob = `${bkprId} ${id} ${cls}`;
    const labelBlob = `${aria} ${title}`;

    // Send: require anchored primary signal OR labeled action word.
    if (SEND_PRIMARY_RE.test(primaryBlob) || SEND_LABEL_RE.test(labelBlob)) {
      const now = Date.now();
      if (now - lastSendAt < SEND_DEDUP_MS) return; // dedup with keydown path
      lastSendAt = now;
      bump("messageSent");
      console.log("[BeePlus stats] send-button click");
      return;
    }
    if (REACTION_PRIMARY_RE.test(primaryBlob) || REACTION_LABEL_RE.test(labelBlob)) {
      bump("reactionGiven");
      console.log("[BeePlus stats] reaction");
    }
  }

  function scheduleAttach() {
    if (attachScheduled) return;
    attachScheduled = true;
    // rAF-throttled: on high-traffic chats the observer fires dozens of times
    // per second — a full shadow-DOM tree walk on each mutation is a real
    // perf hazard. rAF-throttling gives us one walk per frame at most.
    // Track the rAF id so teardown can cancel it — otherwise the frame
    // callback still fires after teardown and re-attaches keydown handlers.
    attachRafId = requestAnimationFrame(() => {
      attachRafId = 0;
      attachScheduled = false;
      if (!observerStop) return; // teardown-guard: feature is disabled
      attachAllComposers();
    });
  }

  function init() {
    attachAllComposers();
    observerStop = window.BeePlus.dom.observe(document.body, { childList: true, subtree: true }, scheduleAttach);
    reactionClickHandler = onAnyClick;
    // Attach to document AND every shadow-root — clicks on send/reaction
    // buttons inside <beekeeper-chats-view>'s shadow-DOM otherwise never
    // reach the document listener.
    const dom = window.BeePlus.dom;
    if (dom && dom.addListenerAcrossShadows) {
      detachClick = dom.addListenerAcrossShadows("click", reactionClickHandler, { capture: true });
    } else {
      document.addEventListener("click", reactionClickHandler, true);
    }
    console.log("[BeePlus stats] tracking active");
  }

  function teardown() {
    if (observerStop) { observerStop(); observerStop = null; }
    if (detachClick) { detachClick(); detachClick = null; }
    if (reactionClickHandler) {
      document.removeEventListener("click", reactionClickHandler, true);
      reactionClickHandler = null;
    }
    // Cancel the pending rAF — otherwise the frame callback still fires
    // after teardown, calls attachAllComposers(), and re-populates
    // composerHandlers with fresh keydown listeners that survive disable.
    if (attachRafId) { cancelAnimationFrame(attachRafId); attachRafId = 0; }
    attachScheduled = false;
    // Actually detach the keydown handlers instead of just dropping the
    // WeakSet — otherwise the next init() double-attaches and every Enter
    // press double-counts thereafter.
    composerHandlers.forEach((handler, ta) => {
      try { ta.removeEventListener("keydown", handler, true); } catch (_) {}
    });
    composerHandlers.clear();
    lastSendAt = 0;
  }

  window.BeePlus.FeatureRegistry.register({
    id: "personal-stats",
    name: "featurePersonalStats",
    description: "featurePersonalStatsDesc",
    defaultEnabled: true,
    settingsKey: SETTINGS_KEY,
    init,
    teardown
  });
})();
