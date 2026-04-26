// BeePlus content-script entry point.
// Message router is set up in core/registry.js (loaded first).
// content.js bootstraps i18n + initializes enabled features.

(async () => {
  if (!window.BeePlus || !window.BeePlus.FeatureRegistry) {
    console.error("[BeePlus] FeatureRegistry missing - check manifest script order");
    return;
  }

  // Load user's language preference for tooltip / FAB texts
  if (window.BeePlusI18n) {
    try { await window.BeePlusI18n.loadLanguage(); } catch (_) {}
  }

  console.log("[BeePlus] active, features registered:",
    window.BeePlus.FeatureRegistry.list().map((f) => f.id));

  try {
    await window.BeePlus.FeatureRegistry.initAll({});
  } catch (err) {
    console.error("[BeePlus] initAll failed:", err);
  }
})();
