// BeePlus options page — feature-card grid with toggles, collapsible
// settings, language switcher, donation section.

const I18N = window.BeePlusI18n;

// Feature icon mapping (emoji shown in the gradient square on each card).
const FEATURE_ICONS = {
  "profile-hover": "👤",
  "sticky-pin": "📌",
  "quick-polls": "📊",
  "personal-stats": "📈",
  "reminder-bot": "⏰",
  "theme-engine": "🎨"
};

// Order in which features appear in the grid.
const FEATURE_ORDER = [
  "profile-hover",
  "sticky-pin",
  "quick-polls",
  "personal-stats",
  "reminder-bot",
  "theme-engine"
];

let expandedFeature = null;

function applyTranslations() {
  document.querySelectorAll("[data-t]").forEach((el) => {
    const v = I18N.t(el.dataset.t);
    if (v) el.textContent = v;
  });
  document.querySelectorAll("[data-t-placeholder]").forEach((el) => {
    const v = I18N.t(el.dataset.tPlaceholder);
    if (v) el.placeholder = v;
  });
  document.title = I18N.t("optionsHeading") || document.title;
  // Lang button label
  const lc = document.getElementById("langCurrent");
  if (lc) lc.textContent = I18N.getLanguage() === "de" ? "🇩🇪 DE" : "🇬🇧 EN";
}

function setupLanguageSwitcher() {
  const btn = document.getElementById("langBtn");
  const menu = document.getElementById("langMenu");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    refreshLangMenuActive();
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== btn) menu.hidden = true;
  });

  menu.querySelectorAll("button[data-lang]").forEach((b) => {
    b.addEventListener("click", async () => {
      const lang = b.dataset.lang;
      await I18N.setLanguage(lang);
      menu.hidden = true;
      // Re-render all
      applyTranslations();
      await renderFeatures();
    });
  });

  function refreshLangMenuActive() {
    const cur = I18N.getLanguage();
    menu.querySelectorAll("button[data-lang]").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === cur);
    });
  }
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

  const all = window.BeePlusOptions.list();
  // Sort by FEATURE_ORDER
  const ordered = [];
  for (const id of FEATURE_ORDER) {
    const f = all.find((x) => x.id === id);
    if (f) ordered.push(f);
  }
  for (const f of all) if (!ordered.includes(f)) ordered.push(f);

  for (const f of ordered) {
    const enabled = await isFeatureEnabled(f.id, f.defaultEnabled);
    const card = buildCard(f, enabled);
    list.appendChild(card);
  }

  // Decorative "More coming soon" card
  list.appendChild(buildComingSoonCard());
}

function buildCard(f, enabled) {
  const card = document.createElement("div");
  card.className = "feature-card";
  if (expandedFeature === f.id) card.classList.add("expanded");

  // Head row
  const head = document.createElement("div");
  head.className = "feature-head";

  const icon = document.createElement("div");
  icon.className = "feature-icon";
  icon.textContent = FEATURE_ICONS[f.id] || "✨";
  head.appendChild(icon);

  const body = document.createElement("div");
  body.className = "feature-body";
  const h3 = document.createElement("h3");
  h3.textContent = I18N.t(f.name);
  const p = document.createElement("p");
  p.textContent = I18N.t(f.description);
  body.appendChild(h3);
  body.appendChild(p);
  head.appendChild(body);

  const toggle = document.createElement("label");
  toggle.className = "switch";
  // Stop ALL events on toggle from bubbling to the card head
  ["click", "mousedown", "mouseup"].forEach((ev) =>
    toggle.addEventListener(ev, (e) => e.stopPropagation())
  );
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = enabled;
  cb.addEventListener("change", async (e) => {
    e.stopPropagation();
    const newState = cb.checked;
    await setFeatureEnabled(f.id, newState);
    // Reload Beekeeper tabs so feature init/teardown runs
    const tabs = await chrome.tabs.query({ url: "https://*.beekeeper.io/*" });
    for (const t of tabs) {
      try { await chrome.tabs.reload(t.id); } catch (_) {}
    }
  });
  const slider = document.createElement("span");
  slider.className = "slider";
  toggle.appendChild(cb);
  toggle.appendChild(slider);
  head.appendChild(toggle);

  // Click on the body / icon area → expand/collapse (NOT on toggle)
  head.addEventListener("click", (e) => {
    if (toggle.contains(e.target)) return; // safety net
    if (expandedFeature === f.id) expandedFeature = null;
    else expandedFeature = f.id;
    renderFeatures();
  });

  card.appendChild(head);

  // Settings panel — only render when expanded (saves work)
  if (expandedFeature === f.id) {
    const panel = document.createElement("div");
    panel.className = "feature-settings-panel";
    if (typeof f.render === "function") {
      try { f.render(panel); } catch (e) {
        panel.innerHTML = `<p class="hint" style="color:#b91c1c;">Error: ${e.message}</p>`;
      }
    } else {
      panel.innerHTML = `<p class="hint">No settings.</p>`;
    }
    card.appendChild(panel);
  }

  return card;
}

function buildComingSoonCard() {
  const card = document.createElement("div");
  card.className = "feature-card coming-soon";
  card.style.cursor = "default";
  const head = document.createElement("div");
  head.className = "feature-head";
  const icon = document.createElement("div");
  icon.className = "feature-icon";
  icon.textContent = "+";
  head.appendChild(icon);
  const body = document.createElement("div");
  body.className = "feature-body";
  const h3 = document.createElement("h3");
  h3.textContent = I18N.t("moreSoonTitle");
  const p = document.createElement("p");
  p.textContent = I18N.t("moreSoonDesc");
  body.appendChild(h3);
  body.appendChild(p);
  head.appendChild(body);
  card.appendChild(head);
  return card;
}

function setVersion() {
  const v = chrome.runtime.getManifest().version;
  const el = document.getElementById("versionDisplay");
  if (el) el.textContent = v;
}

async function refreshDebug() {
  const sync = await chrome.storage.sync.get(null);
  const local = await chrome.storage.local.get(null);
  const el = document.getElementById("rawData");
  if (el) el.textContent = JSON.stringify({ sync, local }, null, 2);
}

document.getElementById("clearCache").addEventListener("click", async () => {
  await chrome.storage.local.clear();
  await refreshDebug();
  await renderFeatures();
});

(async () => {
  await I18N.loadLanguage();
  applyTranslations();
  setVersion();
  setupLanguageSwitcher();
  await renderFeatures();
  await refreshDebug();
})();
