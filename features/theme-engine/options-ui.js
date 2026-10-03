// Theme Engine settings: preset picker + custom CSS editor.

(function () {
  const SETTINGS_KEY = "feature.themeEngine";
  const DEFAULTS = { preset: "none", customCss: "" };
  const PRESETS = [
    ["none", "themePresetNone"],
    ["compact", "themePresetCompact"],
    ["reading", "themePresetReading"],
    ["largerFont", "themePresetLargerFont"],
    ["focusOutline", "themePresetFocusOutline"],
    ["minimalReactions", "themePresetMinimalReactions"],
    ["custom", "themePresetCustom"]
  ];

  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  async function load() {
    const got = await chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULTS });
    return Object.assign({}, DEFAULTS, got[SETTINGS_KEY] || {});
  }

  async function save(cfg) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: cfg });
  }

  function render(container) {
    const UI = window.BeePlusUI;
    const { el } = UI;
    container.textContent = "";

    load().then((cfg) => {
      let selected = cfg.preset;

      const css = el("textarea", {
        class: "textarea css-editor",
        attrs: {
          spellcheck: "false",
          placeholder: i18n("customCssPlaceholder", "/* Custom CSS for *.beekeeper.io */"),
          "aria-label": i18n("themePresetCustom", "Custom CSS")
        }
      });
      css.value = cfg.customCss || "";
      css.disabled = selected !== "custom";

      const tiles = PRESETS.map(([value, key]) => {
        const radio = el("input", { attrs: { type: "radio", name: "bkpr-theme-preset", value } });
        radio.checked = value === selected;
        radio.addEventListener("change", () => {
          selected = value;
          css.disabled = value !== "custom";
        });
        return el("label", { class: "preset" }, radio, el("span", { class: "preset-radio" }), el("span", { text: i18n(key, value) }));
      });

      container.append(
        UI.notice(i18n("themeNote", "Beekeeper has its own dark mode. BeePlus only adjusts layout, font and accessibility.")),
        UI.section(i18n("themePresetLabel", "Preset"), null,
          el("div", { class: "preset-grid", attrs: { role: "radiogroup", "aria-label": i18n("themePresetLabel", "Preset") } }, ...tiles),
          css,
          el("div", { class: "actions-row" },
            UI.button(i18n("applyThemeBtn", "Apply"), {
              variant: "primary",
              icon: "check",
              onClick: async () => {
                await save({ preset: selected, customCss: css.value });
                // The in-page engine only listens for changes while the feature is on.
                const key = "feature.theme-engine.enabled";
                const on = (await chrome.storage.sync.get({ [key]: false }))[key];
                UI.toast(on
                  ? i18n("themeSaved", "Theme saved. Open Beekeeper tabs update automatically.")
                  : i18n("themeSavedOff", "Theme saved. Turn on Theme Tweaks to apply it."));
              }
            })
          )
        )
      );
    });
  }

  window.BeePlusOptions.register({
    id: "theme-engine",
    name: "featureThemeEngine",
    description: "featureThemeEngineDesc",
    defaultEnabled: false,
    render
  });
})();
