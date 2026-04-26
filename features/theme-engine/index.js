// Feature: Theme Engine — inject custom CSS into Beekeeper based on chosen preset.

(function () {
  const SETTINGS_KEY = "feature.themeEngine";
  const STYLE_ID = "bkpr-theme-engine-style";
  const DEFAULTS = { preset: "none", customCss: "" };

  // BeePlus theme tweaks. Note: Beekeeper has its own dark mode (in your
  // Beekeeper account settings — use that for full dark theme).
  // BeePlus presets are LAYOUT-tweaks + accessibility, not full theme rewrites.
  // SAFE tweaks only. Beekeeper's own dark mode (Settings → Theme in Beekeeper)
  // does the actual color theming. BeePlus presets only adjust layout density,
  // font, accessibility outlines.
  const PRESETS = {
    none: "",

    // Tighter spacing — more chats/messages on screen.
    compact: `
      [class*="message"], [class*="bubble"] { padding: 6px 12px !important; line-height: 1.35 !important; margin: 2px 0 !important; }
      [class*="message"] img[class*="avatar"], [class*="bubble"] img[class*="avatar"] { width: 28px !important; height: 28px !important; }
      [class*="chat-list-item"], [class*="conversation-item"], [class*="stream-list-item"] { padding: 8px 10px !important; min-height: auto !important; }
    `,

    // Serif font for messages — easier on eyes for long posts.
    reading: `
      [class*="message"] [class*="content"], [class*="message"] [class*="text"], [class*="bubble"] {
        font-family: Georgia, 'Times New Roman', Cambria, serif !important;
        font-size: 15px !important;
        line-height: 1.6 !important;
      }
    `,

    // Larger fonts everywhere — accessibility.
    largerFont: `
      html, body { font-size: 17px !important; }
      [class*="message"] [class*="content"], [class*="message"] [class*="text"] { font-size: 16px !important; line-height: 1.6 !important; }
    `,

    // Strong focus outlines — accessibility for keyboard users.
    focusOutline: `
      :focus-visible {
        outline: 3px solid #ff6600 !important;
        outline-offset: 2px !important;
        border-radius: 4px !important;
      }
    `,

    // Hide reactions counter (less visual noise).
    minimalReactions: `
      [class*="reaction-count"], [class*="reactions-summary"] { display: none !important; }
    `,

    custom: ""
  };

  function injectCss(css) {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  function removeCss() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  async function applyFromSettings() {
    const got = await chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULTS });
    const cfg = Object.assign({}, DEFAULTS, got[SETTINGS_KEY] || {});
    let css = "";
    if (cfg.preset === "custom") css = cfg.customCss || "";
    else css = PRESETS[cfg.preset] || "";
    injectCss(css);
  }

  function onStorageChange(changes, area) {
    if (area !== "sync" || !changes[SETTINGS_KEY]) return;
    applyFromSettings();
  }

  async function init() {
    chrome.storage.onChanged.addListener(onStorageChange);
    await applyFromSettings();
  }

  function teardown() {
    chrome.storage.onChanged.removeListener(onStorageChange);
    removeCss();
  }

  window.BeePlus.themeEngine = { PRESETS };
  window.BeePlus.FeatureRegistry.register({
    id: "theme-engine",
    name: "featureThemeEngine",
    description: "featureThemeEngineDesc",
    defaultEnabled: false,
    settingsKey: SETTINGS_KEY,
    init,
    teardown
  });
})();
