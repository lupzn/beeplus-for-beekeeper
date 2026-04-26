// BeePlus content-script entry point.
// 1) Validates registry/api are loaded.
// 2) Registers a global runtime.onMessage router so options-page can talk to
//    any feature even if its init() failed.
// 3) Boots all enabled features.

(async () => {
  if (!window.BeePlus || !window.BeePlus.FeatureRegistry) {
    console.error("[BeePlus] FeatureRegistry missing - check manifest script order");
    return;
  }

  // Global message router — runs regardless of feature init success.
  // Each handler is a function returning a Promise<{ok, ...}>.
  const handlers = {};
  window.BeePlus.registerMessageHandler = (target, fn) => {
    handlers[target] = fn;
    console.log(`[BeePlus] message handler registered: ${target}`);
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.target) return;
    const fn = handlers[msg.target];
    if (!fn) {
      sendResponse({ ok: false, error: `No handler for ${msg.target}` });
      return;
    }
    Promise.resolve(fn(msg, sender)).then(
      (res) => sendResponse(res || { ok: true }),
      (err) => sendResponse({ ok: false, error: err.message || String(err) })
    );
    return true;
  });

  console.log("[BeePlus] active, features registered:",
    window.BeePlus.FeatureRegistry.list().map((f) => f.id));
  try {
    await window.BeePlus.FeatureRegistry.initAll({});
  } catch (err) {
    console.error("[BeePlus] initAll failed:", err);
  }
})();
