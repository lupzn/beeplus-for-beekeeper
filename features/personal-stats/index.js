// Feature: Personal Stats — observes user actions in Beekeeper and increments
// local counters via core/stats-tracker.js. All data stays in chrome.storage.local.

(function () {
  const SETTINGS_KEY = "feature.personalStats";
  const stats = window.BeePlus.stats;

  let composerKeyHandler = null;
  let reactionClickHandler = null;
  let trackedComposers = new WeakSet();

  // Lenient: any textarea/contenteditable in lower viewport.
  function findAllComposers() {
    return [...document.querySelectorAll('textarea, [contenteditable="true"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 100 && r.height > 20 && r.bottom > window.innerHeight * 0.4;
      });
  }

  function attachAllComposers() {
    for (const ta of findAllComposers()) {
      if (trackedComposers.has(ta)) continue;
      trackedComposers.add(ta);
      const handler = (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          const txt = (ta.value || ta.textContent || "").trim();
          if (txt) {
            stats.bump("messageSent");
            console.log("[BeePlus stats] message sent");
          }
        }
      };
      ta.addEventListener("keydown", handler, true);
    }
  }

  // Catch send-button clicks too (for users who click instead of pressing Enter).
  function onAnyClick(e) {
    const btn = e.target.closest('button, [role="button"]');
    if (!btn) return;
    const cls = (btn.className || "").toString().toLowerCase();
    const id = (btn.id || "").toLowerCase();
    const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
    const title = (btn.getAttribute("title") || "").toLowerCase();
    const bkprId = (btn.getAttribute("data-bkpr-id") || "").toLowerCase();
    const blob = `${cls} ${id} ${aria} ${title} ${bkprId}`;
    if (/send|submit|absend|abschick/.test(blob)) {
      stats.bump("messageSent");
      console.log("[BeePlus stats] send-button click");
    } else if (/reaction|react|emoji/.test(blob)) {
      stats.bump("reactionGiven");
      console.log("[BeePlus stats] reaction");
    }
  }

  let observerStop = null;
  function init() {
    attachAllComposers();
    observerStop = window.BeePlus.dom.observe(document.body, { childList: true, subtree: true }, attachAllComposers);

    reactionClickHandler = onAnyClick;
    document.addEventListener("click", reactionClickHandler, true);
    console.log("[BeePlus stats] tracking active");
  }

  function teardown() {
    if (observerStop) observerStop();
    if (reactionClickHandler) document.removeEventListener("click", reactionClickHandler, true);
    trackedComposers = new WeakSet();
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
