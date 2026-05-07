// BeePlus content-script entry point.
// Message router is set up in core/registry.js (loaded first).
// Route filter: skip features on Beekeeper admin/dashboard pages where the
// extension would interfere with native UI.

(async () => {
  if (!window.BeePlus || !window.BeePlus.FeatureRegistry) {
    console.error("[BeePlus] FeatureRegistry missing - check manifest script order");
    return;
  }

  // Load user's language preference for tooltip / FAB texts
  if (window.BeePlusI18n) {
    try { await window.BeePlusI18n.loadLanguage(); } catch (_) {}
  }

  // Routes where BeePlus should stay out of the way completely.
  // Beekeeper admin pages have their own UI patterns that conflict with our
  // injected elements (e.g. dashboard tables).
  const BLOCKED_PATHS = [
    /^\/dashboard(?:\/|$)/,
    /^\/admin(?:\/|$)/,
    /^\/manage(?:\/|$)/
  ];

  function isBlockedRoute() {
    return BLOCKED_PATHS.some((re) => re.test(location.pathname));
  }

  console.log("[BeePlus] active, features registered:",
    window.BeePlus.FeatureRegistry.list().map((f) => f.id),
    "| pathname:", location.pathname);

  let initializedFor = null; // pathname for which features are currently active

  async function syncFeatures() {
    const blocked = isBlockedRoute();
    if (blocked && initializedFor !== null) {
      console.log("[BeePlus] route is blocked, tearing down features:", location.pathname);
      try { await window.BeePlus.FeatureRegistry.teardownAll(); } catch (e) { console.error(e); }
      initializedFor = null;
    } else if (!blocked && initializedFor === null) {
      console.log("[BeePlus] route allowed, initializing features:", location.pathname);
      try { await window.BeePlus.FeatureRegistry.initAll({}); } catch (e) { console.error("[BeePlus] initAll failed:", e); }
      initializedFor = location.pathname;
    }
  }

  // Initial sync
  await syncFeatures();

  // Observe SPA URL changes (Beekeeper uses History API + SPA routing)
  let lastPath = location.pathname;
  function onMaybeUrlChange() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      syncFeatures();
    }
  }
  // pushState / replaceState patches
  ["pushState", "replaceState"].forEach((m) => {
    const orig = history[m];
    history[m] = function () {
      const ret = orig.apply(this, arguments);
      onMaybeUrlChange();
      return ret;
    };
  });
  window.addEventListener("popstate", onMaybeUrlChange);
  // Fallback: poll every 500ms (some SPAs avoid History API)
  setInterval(onMaybeUrlChange, 500);
})();
