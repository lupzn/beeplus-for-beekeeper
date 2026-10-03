// BeePlus options page: sidebar navigation, overview dashboard and one detail
// view per feature. Hash routes: #/ (overview), #/<feature-id>, #/about.

const I18N = window.BeePlusI18n;
const UI = window.BeePlusUI;
const { el, icon } = UI;

const REPO_URL = "https://github.com/lupzn/beeplus-for-beekeeper";
const DONATE_URL = "https://www.paypal.com/donate/?hosted_button_id=X8MG6CZK2PETS";
const VERSION = chrome.runtime.getManifest().version;

const FEATURE_ORDER = [
  "profile-hover",
  "sticky-pin",
  "quick-polls",
  "personal-stats",
  "reminder-bot",
  "theme-engine"
];

const enabled = {};
let features = [];

function t(key, vars) {
  let s = I18N.t(key) || key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

function orderedFeatures() {
  const all = window.BeePlusOptions.list();
  const ordered = FEATURE_ORDER.map((id) => all.find((f) => f.id === id)).filter(Boolean);
  for (const f of all) if (!ordered.includes(f)) ordered.push(f);
  return ordered;
}

const enabledKey = (id) => `feature.${id}.enabled`;

async function loadEnabled() {
  const defaults = {};
  for (const f of features) defaults[enabledKey(f.id)] = f.defaultEnabled !== false;
  const got = await chrome.storage.sync.get(defaults);
  for (const f of features) enabled[f.id] = !!got[enabledKey(f.id)];
}

async function setEnabled(f, on) {
  enabled[f.id] = on;
  syncStatus(f.id);
  await chrome.storage.sync.set({ [enabledKey(f.id)]: on });
  // Reload Beekeeper tabs so the feature's init/teardown runs.
  const tabs = await chrome.tabs.query({ url: "https://*.beekeeper.io/*" });
  for (const tab of tabs) {
    try { await chrome.tabs.reload(tab.id); } catch (_) {}
  }
  let msg = t(on ? "toastEnabled" : "toastDisabled", { name: t(f.name) });
  if (tabs.length) msg += " " + t("toastReload");
  UI.toast(msg, tabs.length ? "refresh" : "check");
}

function activeCountText() {
  const n = features.filter((f) => enabled[f.id]).length;
  return t("heroActive", { n, total: features.length });
}

// Push one feature's on/off state into every element that mirrors it.
function syncStatus(id) {
  const on = !!enabled[id];
  document.querySelectorAll(`[data-feature="${id}"]`).forEach((n) => {
    n.classList.toggle("is-on", on);
    n.querySelectorAll(".status-text").forEach((s) => { s.textContent = t(on ? "statusOn" : "statusOff"); });
  });
  document.querySelectorAll(`input[data-feature-switch="${id}"]`).forEach((i) => { i.checked = on; });
  const count = document.getElementById("activeCount");
  if (count) count.textContent = activeCountText();
  const off = document.getElementById("offNotice");
  if (off && off.dataset.for === id) off.hidden = on;
}

function statusBadge(id) {
  return el("span", { class: "status" + (enabled[id] ? " is-on" : ""), attrs: { "data-feature": id } },
    el("span", { class: "status-dot", attrs: { "aria-hidden": "true" } }),
    el("span", { class: "status-text", text: t(enabled[id] ? "statusOn" : "statusOff") })
  );
}

function featureSwitch(f) {
  const sw = UI.switchControl({
    checked: enabled[f.id],
    label: t("toggleAria", { name: t(f.name) }),
    onChange: (v) => setEnabled(f, v)
  });
  sw.input.dataset.featureSwitch = f.id;
  return sw;
}

function linkButton(href, iconName, text, variant) {
  return el("a", { class: "btn btn-" + variant, attrs: { href, target: "_blank", rel: "noopener noreferrer" } },
    icon(iconName, { size: 16 }), el("span", { text }));
}

// ---------- Sidebar ----------

function navLink(href, iconName, label, featureId) {
  const a = el("a", { class: "nav-item", attrs: { href } },
    el("span", { class: "nav-icon" }, icon(iconName, { size: 18 })),
    el("span", { class: "nav-text", text: label })
  );
  if (featureId) {
    a.dataset.feature = featureId;
    a.classList.toggle("is-on", !!enabled[featureId]);
    a.appendChild(el("span", { class: "nav-dot", attrs: { "aria-hidden": "true" } }));
    a.appendChild(el("span", { class: "sr-only status-text", text: t(enabled[featureId] ? "statusOn" : "statusOff") }));
  }
  return a;
}

function renderNav() {
  const nav = document.getElementById("nav");
  nav.textContent = "";
  nav.setAttribute("aria-label", t("navLabel"));
  nav.append(
    navLink("#/", "overview", t("navOverview")),
    el("div", { class: "nav-label", text: t("navFeatures") }),
    ...features.map((f) => navLink(`#/${f.id}`, f.id, t(f.name), f.id)),
    el("div", { class: "nav-label", text: t("navMore") }),
    navLink("#/about", "info", t("navAbout"))
  );
}

function markActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach((a) => {
    const active = a.getAttribute("href") === `#/${route}`;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

// ---------- Overview ----------

function honeycomb() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 260 220");
  svg.setAttribute("class", "hero-art");
  svg.setAttribute("aria-hidden", "true");
  const r = 27;
  const w = Math.sqrt(3) * r;
  const cells = [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3]];
  for (const [c, row] of cells) {
    const cx = 34 + c * w + (row % 2 ? 0 : w / 2);
    const cy = 34 + row * 1.5 * r;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = ((60 * i - 90) * Math.PI) / 180;
      pts.push(`${(cx + (r - 3) * Math.cos(a)).toFixed(1)},${(cy + (r - 3) * Math.sin(a)).toFixed(1)}`);
    }
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", pts.join(" "));
    const honey = c === 2 && row === 1;
    poly.setAttribute("class", honey ? "hc-honey" : (c + row) % 3 === 0 ? "hc-cell hc-soft" : "hc-cell");
    svg.appendChild(poly);
    if (honey) {
      const txt = document.createElementNS(NS, "text");
      txt.setAttribute("x", cx.toFixed(1));
      txt.setAttribute("y", (cy + 7).toFixed(1));
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("class", "hc-label");
      txt.textContent = "B+";
      svg.appendChild(txt);
    }
  }
  return svg;
}

function featureCard(f) {
  return el("article", { class: "fcard" + (enabled[f.id] ? " is-on" : ""), attrs: { "data-feature": f.id } },
    el("div", { class: "fcard-top" },
      el("span", { class: "ficon" }, icon(f.id, { size: 22 })),
      featureSwitch(f)
    ),
    el("h3", { class: "fcard-title" },
      el("a", { class: "fcard-link", attrs: { href: `#/${f.id}` }, text: t(f.name) })
    ),
    el("p", { class: "fcard-desc", text: t(f.description) }),
    el("div", { class: "fcard-foot" },
      statusBadge(f.id),
      el("span", { class: "fcard-cta", attrs: { "aria-hidden": "true" } }, t("settingsCta"), icon("chevron-right", { size: 16 }))
    )
  );
}

function comingSoonCard() {
  return el("article", { class: "fcard fcard-soon" },
    el("div", { class: "fcard-top" },
      el("span", { class: "ficon ficon-soon" }, icon("plus", { size: 22 }))
    ),
    el("h3", { class: "fcard-title", text: t("moreSoonTitle") }),
    el("p", { class: "fcard-desc", text: t("moreSoonDesc") }),
    el("div", { class: "fcard-foot" },
      el("a", { class: "text-link", attrs: { href: `${REPO_URL}/issues`, target: "_blank", rel: "noopener noreferrer" } },
        icon("lightbulb", { size: 16 }), el("span", { text: t("suggestFeature") }))
    )
  );
}

function supportCard() {
  return el("section", { class: "support" },
    el("span", { class: "support-icon" }, icon("heart", { size: 22 })),
    el("div", { class: "support-body" },
      el("h2", { text: t("supportTitle") }),
      el("p", { text: t("supportText") })
    ),
    el("div", { class: "support-actions" },
      linkButton(REPO_URL, "github", t("donationGithubBtn"), "secondary"),
      linkButton(DONATE_URL, "heart", t("donationPaypalBtn"), "honey")
    )
  );
}

function disclaimer() {
  return el("p", { class: "disclaimer", text: t("disclaimer") });
}

function renderOverview() {
  const hero = el("section", { class: "hero" },
    el("div", { class: "hero-body" },
      el("span", { class: "hero-eyebrow" }, icon("hexagon", { size: 14, stroke: 2.25 }), t("heroEyebrow")),
      el("h1", { class: "hero-title", text: t("heroTitle") }),
      el("p", { class: "hero-text", text: t("heroText") }),
      el("div", { class: "hero-chips" },
        el("span", { class: "chip" }, icon("check", { size: 14, stroke: 2.25 }), el("span", { attrs: { id: "activeCount" }, text: activeCountText() })),
        el("span", { class: "chip" }, icon("shield", { size: 14 }), el("span", { text: t("heroLocal") })),
        el("span", { class: "chip" }, icon("tag", { size: 14 }), el("span", { text: `v${VERSION}` }))
      )
    ),
    honeycomb()
  );

  return el("div", { class: "page" },
    hero,
    el("div", { class: "section-head" },
      el("h2", { text: t("featuresSection") }),
      el("p", { text: t("featuresHint") })
    ),
    el("div", { class: "fgrid" }, ...features.map(featureCard), comingSoonCard()),
    supportCard(),
    disclaimer()
  );
}

// ---------- Feature detail ----------

function renderFeature(f) {
  const body = el("div", { class: "panel-body feature-settings-panel" });
  if (typeof f.render === "function") {
    try { f.render(body); } catch (e) {
      body.appendChild(UI.notice(`${t("errorPrefix")} ${e.message}`, { tone: "danger" }));
    }
  } else {
    body.appendChild(UI.emptyState(f.id, t("noSettings")));
  }

  const off = UI.notice(t("featureOffNotice"), { icon: "info" });
  off.id = "offNotice";
  off.dataset.for = f.id;
  off.hidden = !!enabled[f.id];

  return el("div", { class: "page" },
    el("a", { class: "back-link", attrs: { href: "#/" } }, icon("chevron-left", { size: 16 }), el("span", { text: t("navOverview") })),
    el("header", { class: "fhead" + (enabled[f.id] ? " is-on" : ""), attrs: { "data-feature": f.id } },
      el("span", { class: "ficon ficon-lg" }, icon(f.id, { size: 28 })),
      el("div", { class: "fhead-text" },
        el("h1", { text: t(f.name) }),
        el("p", { text: t(f.description) })
      ),
      el("div", { class: "fhead-toggle" }, statusBadge(f.id), featureSwitch(f))
    ),
    off,
    el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h2", { text: t("settingsTitle") })),
      body
    )
  );
}

// ---------- About & support ----------

function renderAbout() {
  const pre = el("pre", { class: "debug-pre" });
  const refreshDebug = async () => {
    const sync = await chrome.storage.sync.get(null);
    const local = await chrome.storage.local.get(null);
    pre.textContent = JSON.stringify({ sync, local }, null, 2);
  };
  const debug = el("details", { class: "panel debug" },
    el("summary", {},
      icon("terminal", { size: 18 }),
      el("span", { class: "summary-title", text: t("debugSection") }),
      el("span", { class: "summary-hint", text: t("debugHint") }),
      icon("chevron-down", { size: 16, className: "summary-caret" })
    ),
    el("div", { class: "panel-body" },
      UI.button(t("clearCacheBtn"), {
        icon: "trash",
        variant: "danger",
        onClick: async () => {
          // Only the profile-field cache; reminders.list and stats.daily share this area.
          await chrome.storage.local.remove(["knownFields", "fieldLabels"]);
          await refreshDebug();
          UI.toast(t("cacheCleared"));
        }
      }),
      pre
    )
  );
  debug.addEventListener("toggle", () => { if (debug.open) refreshDebug(); });

  const infoRow = (label, value) => el("div", { class: "info-row" },
    el("dt", { text: label }), el("dd", {}, value));

  return el("div", { class: "page" },
    el("header", { class: "page-head" },
      el("h1", { text: t("navAbout") }),
      el("p", { text: t("aboutIntro") })
    ),
    el("div", { class: "about-grid" },
      el("section", { class: "panel" },
        el("div", { class: "panel-head" }, icon("shield", { size: 18 }), el("h2", { text: t("privacyTitle") })),
        el("div", { class: "panel-body" },
          el("p", { class: "body-text", text: t("privacyNote") }),
          el("a", { class: "text-link", attrs: { href: `${REPO_URL}/blob/main/PRIVACY.md`, target: "_blank", rel: "noopener noreferrer" } },
            el("span", { text: t("privacyLink") }), icon("external", { size: 14 }))
        )
      ),
      el("section", { class: "panel" },
        el("div", { class: "panel-head" }, icon("info", { size: 18 }), el("h2", { text: t("aboutTitle") })),
        el("dl", { class: "panel-body info-list" },
          infoRow(t("aboutVersion"), `v${VERSION}`),
          infoRow(t("aboutLicense"), "Apache 2.0"),
          infoRow(t("aboutDeveloper"), "LUPZN"),
          infoRow(t("aboutSource"), el("a", { class: "text-link", attrs: { href: REPO_URL, target: "_blank", rel: "noopener noreferrer" } },
            el("span", { text: "lupzn/beeplus-for-beekeeper" }), icon("external", { size: 14 })))
        )
      )
    ),
    supportCard(),
    debug,
    disclaimer()
  );
}

// ---------- Router + shell ----------

function currentRoute() {
  return (location.hash || "").replace(/^#\/?/, "");
}

function route() {
  const r = currentRoute();
  const view = document.getElementById("view");
  const f = features.find((x) => x.id === r);
  const known = f ? r : r === "about" ? "about" : "";
  view.textContent = "";
  view.appendChild(f ? renderFeature(f) : known === "about" ? renderAbout() : renderOverview());
  markActiveNav(known);
  window.scrollTo(0, 0);
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-t]").forEach((n) => {
    const v = I18N.t(n.dataset.t);
    if (v) n.textContent = v;
  });
  document.title = t("optionsHeading");
  document.documentElement.lang = I18N.getLanguage();
  const seg = document.getElementById("langSeg");
  seg.setAttribute("aria-label", t("langLabel"));
  seg.querySelectorAll("button[data-lang]").forEach((b) => {
    const on = b.dataset.lang === I18N.getLanguage();
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
    b.title = b.dataset.lang === "de" ? "Deutsch" : "English";
  });
}

let renderedLang = null;

function refreshAll() {
  renderedLang = I18N.getLanguage();
  applyStaticTranslations();
  renderNav();
  route();
}

function setupLanguage() {
  document.getElementById("langIcon").appendChild(icon("globe", { size: 16 }));
  document.querySelectorAll("#langSeg button[data-lang]").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.lang !== I18N.getLanguage()) I18N.setLanguage(b.dataset.lang);
    });
  });
  // setLanguage() notifies directly and again via storage.onChanged.
  I18N.onChange((lang) => { if (lang !== renderedLang) refreshAll(); });
}

(async () => {
  await I18N.loadLanguage();
  features = orderedFeatures();
  await loadEnabled();
  document.getElementById("versionDisplay").textContent = VERSION;
  setupLanguage();
  refreshAll();

  window.addEventListener("hashchange", () => {
    route();
    document.getElementById("view").focus({ preventScroll: true });
  });

  // Keep toggles in sync when another options tab changes a feature.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const f of features) {
      const c = changes[enabledKey(f.id)];
      if (!c) continue;
      const v = c.newValue === undefined ? f.defaultEnabled !== false : !!c.newValue;
      if (v !== enabled[f.id]) {
        enabled[f.id] = v;
        syncStatus(f.id);
      }
    }
  });
})();
