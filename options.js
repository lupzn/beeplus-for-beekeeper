// BeePlus options page orchestration.
// Renders feature list with on/off toggles and per-feature settings panel.

function i18n(key, fb) {
  try { return chrome.i18n.getMessage(key) || fb; } catch (_) { return fb; }
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = i18n(el.dataset.i18n, null);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const msg = i18n(el.dataset.i18nPlaceholder, null);
    if (msg) el.placeholder = msg;
  });
  document.title = i18n("optionsHeading", document.title);
}

async function isFeatureEnabled(id, defaultEnabled) {
  const k = `feature.${id}.enabled`;
  const got = await chrome.storage.sync.get({ [k]: defaultEnabled !== false });
  return !!got[k];
}

async function setFeatureEnabled(id, enabled) {
  await chrome.storage.sync.set({ [`feature.${id}.enabled`]: enabled });
}

async function renderFeatures() {
  const list = document.getElementById("featureList");
  list.innerHTML = "";
  const features = window.BeePlusOptions.list();
  for (const f of features) {
    const enabled = await isFeatureEnabled(f.id, f.defaultEnabled);
    const card = document.createElement("div");
    card.className = "feature-card";

    const head = document.createElement("div");
    head.className = "feature-head";

    const title = document.createElement("div");
    title.className = "feature-title";
    const h = document.createElement("h3");
    h.textContent = i18n(f.name, f.id);
    const desc = document.createElement("p");
    desc.className = "hint";
    desc.textContent = i18n(f.description, "");
    title.appendChild(h);
    title.appendChild(desc);

    const toggle = document.createElement("label");
    toggle.className = "switch";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = enabled;
    cb.onchange = async () => {
      await setFeatureEnabled(f.id, cb.checked);
      // Reload Beekeeper tabs so feature init/teardown takes effect
      const tabs = await chrome.tabs.query({ url: "https://*.beekeeper.io/*" });
      for (const t of tabs) {
        try { await chrome.tabs.reload(t.id); } catch (_) {}
      }
      panel.style.display = cb.checked ? "block" : "none";
    };
    const slider = document.createElement("span");
    slider.className = "slider";
    toggle.appendChild(cb);
    toggle.appendChild(slider);

    head.appendChild(title);
    head.appendChild(toggle);
    card.appendChild(head);

    // Settings panel (collapsed when disabled)
    const panel = document.createElement("div");
    panel.className = "feature-settings-panel";
    panel.style.display = enabled ? "block" : "none";
    if (typeof f.render === "function") {
      f.render(panel);
    } else {
      panel.innerHTML = `<p class="hint">No settings.</p>`;
    }
    card.appendChild(panel);

    list.appendChild(card);
  }
}

async function refreshOnboarding() {
  const local = await chrome.storage.local.get({ knownFields: [] });
  const ob = document.getElementById("onboarding");
  if (ob) ob.hidden = (local.knownFields || []).length > 0;
}

async function refreshDebug() {
  const sync = await chrome.storage.sync.get(null);
  const local = await chrome.storage.local.get(null);
  const el = document.getElementById("rawData");
  if (el) el.textContent = JSON.stringify({ sync, local }, null, 2);
}

document.getElementById("clearCache").addEventListener("click", async () => {
  await chrome.storage.local.clear();
  await refreshOnboarding();
  await refreshDebug();
  await renderFeatures();
});

function setVersion() {
  const v = chrome.runtime.getManifest().version;
  const el = document.getElementById("versionDisplay");
  if (el) el.textContent = v;
}

(async () => {
  applyI18n();
  setVersion();
  await refreshOnboarding();
  await renderFeatures();
  await refreshDebug();
})();
