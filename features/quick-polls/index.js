// Feature: Quick Polls — adds a poll button to the message composer.
// Generates a formatted poll text (with emoji-numbered options) that recipients
// can vote on by reacting with the corresponding emoji.

(function () {
  const SETTINGS_KEY = "feature.quickPolls";
  // The poll is plain message text: recipients vote by reacting with these.
  const NUMBER_EMOJIS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  const POLL_MARK = "📊";

  let floatingBtn = null;
  let fabObserver = null;
  let disposed = false;
  let fabPendingTimer = null;

  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  function buildPollText(question, options) {
    const header = `${POLL_MARK} ${question.trim()}`;
    const body = options
      .filter((o) => o && o.trim())
      .slice(0, 10)
      .map((o, i) => `${NUMBER_EMOJIS[i]} ${o.trim()}`)
      .join("\n");
    return `${header}\n\n${body}\n\n_(${i18n("pollVoteHint", "React with the number of your choice")})_`;
  }

  function openModal() {
    const overlay = document.createElement("div");
    overlay.className = "bkpr-poll-overlay";
    overlay.innerHTML = `
      <div class="bkpr-poll-modal" role="dialog" aria-modal="true" aria-labelledby="bkpr-poll-title">
        <h3 id="bkpr-poll-title">${escape(i18n("featureQuickPolls", "Quick Polls"))}</h3>
        <label for="bkpr-poll-q">${escape(i18n("pollQuestionLabel", "Question"))}</label>
        <input type="text" id="bkpr-poll-q" placeholder="${escape(i18n("pollQuestionPlaceholder", "e.g. Team lunch on Thursday or Friday?"))}">
        <label for="bkpr-poll-opts">${escape(i18n("pollOptionsLabel", "Options (one per line)"))}</label>
        <textarea id="bkpr-poll-opts" rows="5"></textarea>
        <label>${escape(i18n("pollPreviewLabel", "Preview"))}</label>
        <div class="bkpr-poll-preview" id="bkpr-poll-preview"></div>
        <div class="bkpr-poll-actions">
          <button type="button" id="bkpr-poll-cancel">${escape(i18n("pollCancel", "Cancel"))}</button>
          <button type="button" id="bkpr-poll-copy">${escape(i18n("pollCopy", "Copy to clipboard"))}</button>
          <button type="button" id="bkpr-poll-insert" class="primary">${escape(i18n("pollInsert", "Insert into message"))}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const q = overlay.querySelector("#bkpr-poll-q");
    const o = overlay.querySelector("#bkpr-poll-opts");
    const preview = overlay.querySelector("#bkpr-poll-preview");
    // Placeholder via JS so `\n` becomes a real newline (inside HTML
    // attributes `\n` is rendered literally as backslash-n).
    o.placeholder = i18n("pollOptionsPlaceholder", "Thursday\nFriday\nNeither works");
    q.focus();

    function updatePreview() {
      const text = buildPollText(q.value || i18n("pollDefaultQuestion", "Question?"), (o.value || "").split("\n"));
      preview.textContent = text;
    }
    q.oninput = updatePreview;
    o.oninput = updatePreview;
    updatePreview();

    overlay.querySelector("#bkpr-poll-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") overlay.remove(); });

    overlay.querySelector("#bkpr-poll-copy").onclick = async () => {
      const text = buildPollText(q.value, o.value.split("\n"));
      try {
        await navigator.clipboard.writeText(text);
        const btn = overlay.querySelector("#bkpr-poll-copy");
        btn.textContent = i18n("pollCopied", "Copied");
        setTimeout(() => overlay.remove(), 800);
      } catch (e) {
        alert(i18n("pollCopyFailed", "Copying failed. Select the preview and copy it by hand."));
      }
    };

    overlay.querySelector("#bkpr-poll-insert").onclick = async (ev) => {
      const insertBtn = ev.currentTarget;
      // Rapid double-click guard — this handler is async; without a disable
      // the poll gets inserted twice into the composer.
      if (insertBtn.disabled) return;
      if (!q.value.trim() || o.value.split("\n").filter((x) => x.trim()).length < 2) {
        alert(i18n("pollNeedInput", "Enter a question and at least 2 options."));
        return;
      }
      insertBtn.disabled = true;
      const text = buildPollText(q.value, o.value.split("\n"));
      // Close modal FIRST so its own textarea isn't picked up as the composer.
      overlay.remove();
      // Wait one frame so DOM removal settles + Beekeeper composer regains focus.
      await new Promise((r) => requestAnimationFrame(r));
      const ta = findAnyComposer();
      if (ta) {
        try { ta.focus(); } catch (_) {}
        window.BeePlus.dom.triggerInput(ta, text);
        console.log("[BeePlus quick-polls] inserted into composer:", ta);
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(text);
          alert(i18n("pollNoComposerCopied", "Message field not found. The poll is in your clipboard, paste it with Ctrl+V."));
        } catch (e) {
          alert(i18n("pollNoComposerFailed", "Message field not found and copying failed.") + "\n\n" + text);
        }
      }
    };
  }

  // Lenient composer lookup. Excludes BeePlus modal contents.
  // Shadow-piercing: Beekeeper's composer lives inside <BEEKEEPER-CHATS-VIEW>'s
  // shadow-root (as <NATIVE-BK-TEXTAREA> containing a real <textarea>).
  function findAnyComposer() {
    const dom = window.BeePlus.dom;
    const isOurs = (el) => el && el.closest && el.closest(".bkpr-poll-overlay");
    // Pierce shadow-root activeElement chains: document.activeElement returns
    // the SHADOW-HOST (e.g. <BEEKEEPER-CHATS-VIEW>) when focus is inside a
    // shadow-root, not the inner <textarea>. Walk down through
    // .shadowRoot.activeElement until we find the leaf.
    let ae = document.activeElement;
    while (ae && ae.shadowRoot && ae.shadowRoot.activeElement) {
      ae = ae.shadowRoot.activeElement;
    }
    if (ae && (ae.tagName === "TEXTAREA" || ae.isContentEditable) && !isOurs(ae)) {
      return ae;
    }
    const all = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll('textarea, [contenteditable="true"]')
      : [...document.querySelectorAll('textarea, [contenteditable="true"]')];
    const candidates = all
      .filter((el) => !isOurs(el))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 100 && r.height > 20 && r.bottom > window.innerHeight * 0.4;
      });
    if (!candidates.length) return null;
    // Ranking: prefer candidates whose shadow-crossing ancestry contains a
    // composer-signature tag/id (NATIVE-BK-TEXTAREA, data-bkpr-id contains
    // "composer"). Only fall back to the visually-lowest textarea when no
    // candidate qualifies.
    const composerLike = (el) => {
      if (!dom || !dom.ancestorsCrossingShadow) return false;
      for (const anc of dom.ancestorsCrossingShadow(el, 6)) {
        if (!anc || !anc.tagName) continue;
        if (/^NATIVE-BK-TEXTAREA/i.test(anc.tagName)) return true;
        const b = anc.getAttribute && anc.getAttribute("data-bkpr-id");
        if (b && /composer/i.test(b)) return true;
      }
      return false;
    };
    const preferred = candidates.filter(composerLike);
    if (preferred.length) return preferred[preferred.length - 1];
    return candidates[candidates.length - 1];
  }

  function escape(s) { return String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]); }

  function injectFloatingButton() {
    const existing = document.getElementById("bkpr-poll-fab");
    if (existing) existing.remove();
    floatingBtn = document.createElement("button");
    floatingBtn.id = "bkpr-poll-fab";
    floatingBtn.type = "button";
    floatingBtn.title = i18n("featureQuickPolls", "Quick Polls");
    floatingBtn.setAttribute("aria-label", floatingBtn.title);
    floatingBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<rect x="3.5" y="4" width="11" height="3.5" rx="1.75"/><rect x="3.5" y="10.25" width="17" height="3.5" rx="1.75"/><rect x="3.5" y="16.5" width="7" height="3.5" rx="1.75"/></svg>';
    floatingBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    floatingBtn.style.display = "none";
    document.body.appendChild(floatingBtn);
    console.log("[BeePlus quick-polls] FAB injected (hidden until composer detected)");
  }

  // Detect any composer-like input on the page (Beekeeper composer, comment box, etc.)
  // Shadow-piercing so that the composer inside Beekeeper's Web-Components
  // is also picked up.
  function hasComposer() {
    const dom = window.BeePlus.dom;
    const candidates = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll('textarea, [contenteditable="true"]')
      : [...document.querySelectorAll('textarea, [contenteditable="true"]')];
    for (const el of candidates) {
      // Exclude our own modal
      if (el.closest && el.closest(".bkpr-poll-overlay")) continue;
      // Exclude options page elements
      if (el.closest && el.closest(".feature-settings-panel")) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 100 && r.height > 18 && r.bottom > 0 && r.top < window.innerHeight) {
        return true;
      }
    }
    return false;
  }

  // Re-inject FAB if Beekeeper removed it; toggle visibility based on composer presence.
  function ensureFabPresent() {
    if (!document.getElementById("bkpr-poll-fab")) {
      injectFloatingButton();
    }
    const fab = document.getElementById("bkpr-poll-fab");
    if (!fab) return;
    fab.style.display = hasComposer() ? "flex" : "none";
  }

  function init() {
    if (!document.getElementById("bkpr-poll-style")) {
      const s = document.createElement("style");
      s.id = "bkpr-poll-style";
      s.textContent = `
        #bkpr-poll-fab {
          position: fixed; bottom: 100px; right: 24px;
          width: 44px; height: 44px;
          border-radius: 50%; border: none;
          background: #5046e5; color: #fff;
          font-size: 20px; cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 2147483646;
          align-items: center; justify-content: center;
          transition: transform 0.15s, background 0.15s, opacity 0.2s;
          opacity: 0.85;
        }
        #bkpr-poll-fab[style*="flex"] { display: flex !important; }
        #bkpr-poll-fab:hover { background: #4338ca; transform: scale(1.08); }
        .bkpr-poll-overlay { position: fixed; inset: 0; background: rgba(15,18,34,0.5); z-index: 2147483647; display:flex; align-items:center; justify-content:center; }
        .bkpr-poll-modal { background:#fff; color:#111827; border-radius:14px; padding:24px; width:520px; max-width:90vw; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; line-height:1.5; text-align:left; max-height:90vh; overflow-y:auto; box-shadow:0 24px 60px -12px rgba(15,18,34,0.45); }
        .bkpr-poll-modal h3 { margin:0 0 12px 0; font-size:17px; font-weight:600; color:#111827; }
        .bkpr-poll-modal label { display:block; font-size:12px; font-weight:600; color:#5b6178; margin:12px 0 4px 0; text-transform:uppercase; letter-spacing:0.05em; }
        .bkpr-poll-modal input, .bkpr-poll-modal textarea { width:100%; padding:8px 10px; border:1px solid #9aa0b4; border-radius:8px; font:inherit; color:#111827; background:#fff; box-sizing:border-box; }
        .bkpr-poll-modal input:focus, .bkpr-poll-modal textarea:focus { outline:2px solid #5046e5; outline-offset:1px; border-color:#5046e5; }
        .bkpr-poll-modal textarea { resize: vertical; }
        .bkpr-poll-preview { padding:12px; background:#f6f7fb; border:1px solid #e4e7f0; border-radius:8px; white-space:pre-wrap; max-height:200px; overflow-y:auto; }
        .bkpr-poll-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; flex-wrap:wrap; }
        .bkpr-poll-actions button { padding:8px 14px; border:1px solid #c5cad8; background:#fff; color:#111827; border-radius:8px; font:inherit; font-weight:600; cursor:pointer; }
        .bkpr-poll-actions button:focus-visible { outline:2px solid #5046e5; outline-offset:2px; }
        .bkpr-poll-actions button.primary { background:#5046e5; color:#fff; border-color:#5046e5; }
        .bkpr-poll-actions button:hover { background:#f3f4f6; }
        .bkpr-poll-actions button.primary:hover { background:#4338ca; }
      `;
      document.head.appendChild(s);
    }
    disposed = false;
    // Defensively dispose any leftover observer from a previous init that
    // ran without an intervening teardown (settings toggle race).
    if (fabObserver) { fabObserver(); fabObserver = null; }
    injectFloatingButton();
    ensureFabPresent();
    // Subtree observer: detect composer add/remove + body changes.
    let pending = false;
    fabObserver = window.BeePlus.dom.observe(document.body, { childList: true, subtree: true }, () => {
      if (disposed || pending) return;
      pending = true;
      fabPendingTimer = setTimeout(() => {
        pending = false;
        fabPendingTimer = null;
        if (disposed) return;
        ensureFabPresent();
      }, 200);
    });
  }

  function teardown() {
    disposed = true;
    if (fabObserver) { fabObserver(); fabObserver = null; }
    if (fabPendingTimer) { clearTimeout(fabPendingTimer); fabPendingTimer = null; }
    if (floatingBtn) { floatingBtn.remove(); floatingBtn = null; }
    const fab = document.getElementById("bkpr-poll-fab");
    if (fab) fab.remove();
    document.querySelectorAll(".bkpr-poll-overlay").forEach((o) => o.remove());
    const s = document.getElementById("bkpr-poll-style");
    if (s) s.remove();
  }

  window.BeePlus.FeatureRegistry.register({
    id: "quick-polls",
    name: "featureQuickPolls",
    description: "featureQuickPollsDesc",
    defaultEnabled: true,
    settingsKey: SETTINGS_KEY,
    init,
    teardown
  });
})();
