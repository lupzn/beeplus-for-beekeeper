// Feature: Profile Hover Tooltip
// Shows configurable profile fields when hovering over an avatar in Beekeeper.

(function () {
  const HOVER_DELAY_MS = 200;
  const SETTINGS_KEY = "feature.profileHover";
  const DEFAULT_SETTINGS = {
    selectedFields: ["display_name_extension", "role"],
    showAvatar: true,
    hoverDelayMs: 200
  };

  let tooltipEl = null;
  let hoverTimer = null;
  let activeAvatar = null;
  const negCache = new Set();

  function i18n(key, fallback) {
    return (window.BeePlusI18n && window.BeePlusI18n.t(key)) || fallback;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.id = "bkpr-hover-tooltip";
    tooltipEl.style.display = "none";
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function positionTooltip(target) {
    const rect = target.getBoundingClientRect();
    const tt = ensureTooltip();
    const margin = 8;
    let left = rect.right + margin;
    let top = rect.top;
    if (left + 320 > window.innerWidth) left = Math.max(margin, rect.left - 320 - margin);
    if (top + 200 > window.innerHeight) top = Math.max(margin, window.innerHeight - 220);
    tt.style.left = `${left + window.scrollX}px`;
    tt.style.top = `${top + window.scrollY}px`;
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = "none";
    activeAvatar = null;
  }

  function showLoading(target) {
    const tt = ensureTooltip();
    tt.innerHTML = `<div class="bkpr-tt-loading">${escapeHtml(i18n("tooltipLoading", "Loading profile..."))}</div>`;
    tt.style.display = "block";
    positionTooltip(target);
  }

  function showError(target, msg) {
    const tt = ensureTooltip();
    tt.innerHTML = `<div class="bkpr-tt-error">${escapeHtml(msg)}</div>`;
    tt.style.display = "block";
    positionTooltip(target);
  }

  function isAvatarCandidate(el) {
    if (!el) return false;
    if (el.tagName === "IMG") {
      const src = el.src || "";
      const cls = el.className || "";
      return /avatar|profile|user/i.test(cls) || /avatar|profile|user|files/i.test(src);
    }
    if (el.tagName === "DIV" || el.tagName === "SPAN") {
      const cls = el.className || "";
      return /avatar|profile-pic|user-pic/i.test(cls);
    }
    return false;
  }

  async function getSettings() {
    const stored = await chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    return Object.assign({}, DEFAULT_SETTINGS, stored[SETTINGS_KEY] || {});
  }

  async function renderTooltipMulti(target, uuids) {
    showLoading(target);
    const api = window.BeePlus.api;
    let data = null;
    let lastErr = null;
    for (const uuid of uuids) {
      if (negCache.has(uuid)) continue;
      try {
        data = await api.fetchProfile(uuid);
        break;
      } catch (err) {
        lastErr = err;
        if (/404/.test(err.message)) negCache.add(uuid);
      }
    }
    if (!data) {
      let msg = lastErr?.message || "Kein Profil";
      if (msg.includes("400")) {
        msg = "Token abgelaufen. Beekeeper Strg+R drücken und nochmal hovern.";
      } else if (msg.includes("404")) {
        msg = "Profil nicht gefunden.";
      } else if (msg.includes("403")) {
        msg = "Keine Berechtigung für dieses Profil.";
      }
      showError(target, msg);
      return;
    }
    await renderWithData(target, data);
  }

  async function renderWithData(target, data) {
    const api = window.BeePlus.api;
    try {
      const settings = await getSettings();
      const fields = settings.selectedFields || [];
      const rows = fields
        .map((f) => {
          const val = api.resolveField(data, f);
          if (val === undefined || val === null || val === "") return "";
          return `<div class="bkpr-tt-row"><span class="bkpr-tt-label">${escapeHtml(api.resolveLabel(data, f))}</span><span class="bkpr-tt-value">${escapeHtml(val)}</span></div>`;
        })
        .filter(Boolean)
        .join("");
      const u = api.userObj(data);
      const name = u.display_name || u.name ||
        `${u.firstname || u.first_name || ""} ${u.lastname || u.last_name || ""}`.trim() || "Profile";
      const ext = u.display_name_extension ? ` <span class="bkpr-tt-ext">(${escapeHtml(u.display_name_extension)})</span>` : "";
      const avatar = settings.showAvatar && u.avatar ? `<img class="bkpr-tt-avatar" src="${escapeHtml(u.avatar)}" alt="">` : "";
      const tt = ensureTooltip();
      tt.innerHTML = `
        <div class="bkpr-tt-header">${avatar}<div class="bkpr-tt-name">${escapeHtml(name)}${ext}</div></div>
        ${rows || `<div class="bkpr-tt-empty">${escapeHtml(i18n("tooltipEmpty", "No fields with values found."))}</div>`}
      `;
      tt.style.display = "block";
      positionTooltip(target);
    } catch (err) {
      showError(target, err.message || "Error");
    }
  }

  let mouseoverHandler = null;
  let mouseoutHandler = null;
  let scrollHandler = null;
  let clickHandler = null;

  async function init() {
    const settings = await getSettings();
    const delay = settings.hoverDelayMs || HOVER_DELAY_MS;
    const api = window.BeePlus.api;

    mouseoverHandler = (e) => {
      const el = e.target;
      if (!isAvatarCandidate(el)) return;
      let uuids = api.extractUuidsFromDom(el);
      if (!uuids.length) {
        const fileUuid = api.resolveAvatarUuid(el);
        const userUuid = fileUuid ? api.avatarUuidToUserUuid(fileUuid) : null;
        if (userUuid) uuids = [userUuid];
      }
      if (!uuids.length) return;
      if (activeAvatar === el) return;
      activeAvatar = el;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => renderTooltipMulti(el, uuids), delay);
    };

    mouseoutHandler = (e) => {
      const el = e.target;
      if (!isAvatarCandidate(el)) return;
      clearTimeout(hoverTimer);
      setTimeout(() => {
        if (!tooltipEl || !tooltipEl.matches(":hover")) hideTooltip();
      }, 150);
    };

    scrollHandler = hideTooltip;
    clickHandler = hideTooltip;

    document.addEventListener("mouseover", mouseoverHandler, true);
    document.addEventListener("mouseout", mouseoutHandler, true);
    window.addEventListener("scroll", scrollHandler, true);
    document.addEventListener("click", clickHandler, true);
  }

  function teardown() {
    if (mouseoverHandler) document.removeEventListener("mouseover", mouseoverHandler, true);
    if (mouseoutHandler) document.removeEventListener("mouseout", mouseoutHandler, true);
    if (scrollHandler) window.removeEventListener("scroll", scrollHandler, true);
    if (clickHandler) document.removeEventListener("click", clickHandler, true);
    hideTooltip();
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  window.BeePlus.FeatureRegistry.register({
    id: "profile-hover",
    name: "featureProfileHover",
    description: "featureProfileHoverDesc",
    defaultEnabled: true,
    settingsKey: SETTINGS_KEY,
    defaultSettings: DEFAULT_SETTINGS,
    init,
    teardown
  });
})();
