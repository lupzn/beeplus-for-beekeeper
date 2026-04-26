// Theme Engine options UI: preset picker + custom CSS textarea.

(function () {
  const SETTINGS_KEY = "feature.themeEngine";
  const DEFAULTS = { preset: "none", customCss: "" };

  function i18n(k, fb) { try { return chrome.i18n.getMessage(k) || fb; } catch (_) { return fb; } }

  async function load() {
    const got = await chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULTS });
    return Object.assign({}, DEFAULTS, got[SETTINGS_KEY] || {});
  }

  async function save(cfg) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: cfg });
  }

  function render(container) {
    container.innerHTML = "";
    load().then((cfg) => {
      const root = document.createElement("div");
      root.className = "feature-settings";

      const note = document.createElement("p");
      note.className = "hint";
      note.style.cssText = "background:#fef3c7;border:1px solid #fde68a;color:#92400e;padding:8px 10px;border-radius:6px;margin-bottom:12px;";
      note.textContent = "ℹ️ Beekeeper hat eigenes Dark-Theme (Beekeeper Settings → Theme). BeePlus-Tweaks unten = nur Layout/Font/Accessibility.";
      root.appendChild(note);

      const lbl = document.createElement("label");
      lbl.style.display = "block";
      lbl.style.fontSize = "13px";
      lbl.style.marginBottom = "4px";
      lbl.textContent = i18n("themePresetLabel", "Theme preset");
      root.appendChild(lbl);

      const select = document.createElement("select");
      select.style.cssText = "padding:8px;border:1px solid #d1d5db;border-radius:6px;width:100%;max-width:300px;font-size:13px;";
      const presets = [
        ["none", "themePresetNone"],
        ["compact", "themePresetCompact"],
        ["reading", "themePresetReading"],
        ["largerFont", "themePresetLargerFont"],
        ["focusOutline", "themePresetFocusOutline"],
        ["minimalReactions", "themePresetMinimalReactions"],
        ["custom", "themePresetCustom"]
      ];
      for (const [val, key] of presets) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = i18n(key, val);
        if (cfg.preset === val) opt.selected = true;
        select.appendChild(opt);
      }
      root.appendChild(select);

      const ta = document.createElement("textarea");
      ta.placeholder = i18n("customCssPlaceholder", "/* Custom CSS */");
      ta.value = cfg.customCss || "";
      ta.style.cssText = "display:block;width:100%;min-height:160px;margin-top:12px;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-family:monospace;font-size:12px;";
      ta.disabled = cfg.preset !== "custom";
      root.appendChild(ta);

      const btn = document.createElement("button");
      btn.className = "primary";
      btn.style.marginTop = "12px";
      btn.textContent = i18n("applyThemeBtn", "Apply");
      root.appendChild(btn);

      select.onchange = () => {
        ta.disabled = select.value !== "custom";
      };

      btn.onclick = async () => {
        await save({ preset: select.value, customCss: ta.value });
        // Beekeeper-Tabs reloaden um sicher zu greifen (theme-engine reapply via onChanged auch live)
      };

      container.appendChild(root);
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
