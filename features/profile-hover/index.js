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
  let outTimer = null;
  let activeAvatar = null;
  // Flag flipped by teardown() so async work still in flight (fetchProfile,
  // hoverTimer, outTimer) cannot resurrect the tooltip after disable.
  let disposed = false;
  const negCache = new Set();
  // Scrollable ancestors we attach hide-listeners to on hover — scroll events
  // do NOT compose across shadow-root boundaries, so a single window-level
  // listener misses shadow-DOM scrollers (Beekeeper's chat-list virtual
  // scroller lives inside <BEEKEEPER-CHATS-VIEW>'s shadow-root).
  const scrollTargets = new Set();

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
    // Measure real dimensions after innerHTML has been set — hard-coded
    // 320×200 would push a taller tooltip off-viewport instead of flipping.
    const ttRect = tt.getBoundingClientRect();
    const w = ttRect.width || 320;
    const h = ttRect.height || 200;
    let left = rect.right + margin;
    let top = rect.top;
    if (left + w > window.innerWidth) left = Math.max(margin, rect.left - w - margin);
    if (top + h > window.innerHeight) top = Math.max(margin, window.innerHeight - h - margin);
    tt.style.left = `${left + window.scrollX}px`;
    tt.style.top = `${top + window.scrollY}px`;
  }

  function hideTooltip() {
    // Clear pending timers too — otherwise a pending hoverTimer fires
    // AFTER hideTooltip and re-shows the tooltip (scroll-to-dismiss and
    // click-to-dismiss during the hover delay were silently defeated).
    clearTimeout(hoverTimer); hoverTimer = null;
    clearTimeout(outTimer); outTimer = null;
    if (tooltipEl) tooltipEl.style.display = "none";
    activeAvatar = null;
    // Detach the per-hover scroll listeners so we don't accumulate handlers
    // across many hovers.
    scrollTargets.forEach((el) => {
      try { el.removeEventListener("scroll", hideTooltip, { capture: true }); } catch (_) {}
    });
    scrollTargets.clear();
  }

  function showLoading(target) {
    if (disposed) return;
    const tt = ensureTooltip();
    tt.innerHTML = `<div class="bkpr-tt-loading">${escapeHtml(i18n("tooltipLoading", "Loading profile..."))}</div>`;
    tt.style.display = "block";
    positionTooltip(target);
  }

  function showError(target, msg) {
    if (disposed) return;
    const tt = ensureTooltip();
    tt.innerHTML = `<div class="bkpr-tt-error">${escapeHtml(msg)}</div>`;
    tt.style.display = "block";
    positionTooltip(target);
  }

  // Safely read a class-string. SVG elements expose className as an
  // SVGAnimatedString whose .toString() returns "[object SVGAnimatedString]"
  // in some engines, which would poison substring matches.
  function classString(el) {
    if (!el) return "";
    if (el.className && typeof el.className === "string") return el.className;
    if (el.className && el.className.baseVal) return el.className.baseVal;
    return el.getAttribute ? (el.getAttribute("class") || "") : "";
  }

  function isAvatarCandidate(el) {
    if (!el || el.nodeType !== 1) return false;
    // Explicit bkpr signal first — Beekeeper's Web-Components tag avatars
    // with data-bkpr-id like "bkpr-avatar", "bkpr-avatar-image",
    // "post-author-avatar". Hashed CSS-class names in shadow-DOM often
    // won't contain the substring "avatar", so bkpr-id is the reliable path.
    const bkpr = el.getAttribute && el.getAttribute("data-bkpr-id");
    if (bkpr && /avatar|profile/i.test(bkpr)) return true;
    if (el.tagName === "IMG") {
      const src = el.src || "";
      const cls = classString(el);
      return /avatar|profile|user/i.test(cls) || /avatar|profile|user|files/i.test(src);
    }
    if (el.tagName === "DIV" || el.tagName === "SPAN") {
      const cls = classString(el);
      return /avatar|profile-pic|user-pic/i.test(cls);
    }
    return false;
  }

  async function getSettings() {
    const stored = await chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    return Object.assign({}, DEFAULT_SETTINGS, stored[SETTINGS_KEY] || {});
  }

  async function renderTooltipMulti(target, uuids) {
    if (disposed) return;
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
    // If the user moved off the avatar (or dismissed via click/scroll)
    // while the fetch was in flight, do NOT resurrect the tooltip.
    if (disposed || activeAvatar !== target) return;
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
    if (disposed || activeAvatar !== target) return;
    const api = window.BeePlus.api;
    try {
      const settings = await getSettings();
      if (disposed || activeAvatar !== target) return;
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

  // Attach hide-on-scroll to every scrollable ancestor of `el`, including
  // ones inside shadow-roots (scroll events do NOT compose across the
  // shadow-boundary, so a document-level listener misses them).
  function attachScrollHiders(el) {
    const dom = window.BeePlus.dom;
    const ancestry = (dom && dom.ancestorsCrossingShadow) ? dom.ancestorsCrossingShadow(el, 20) : [];
    for (const anc of ancestry) {
      if (!anc || !anc.getBoundingClientRect || !anc.addEventListener) continue;
      try {
        const cs = window.getComputedStyle(anc);
        if (cs && (cs.overflowY === "auto" || cs.overflowY === "scroll" || cs.overflow === "auto" || cs.overflow === "scroll")) {
          anc.addEventListener("scroll", hideTooltip, { capture: true, passive: true });
          scrollTargets.add(anc);
        }
      } catch (_) {}
    }
  }

  let mouseoverHandler = null;
  let mouseoutHandler = null;
  let scrollHandler = null;
  let clickHandler = null;
  // Detach functions for the shadow-crossing listeners installed at init.
  let detachMouseover = null;
  let detachMouseout = null;

  async function init() {
    disposed = false;
    const settings = await getSettings();
    const delay = settings.hoverDelayMs || HOVER_DELAY_MS;
    const api = window.BeePlus.api;

    // Beekeeper moved much of the chat UI into Web-Components + Shadow-DOM.
    // event.target is retargeted to the shadow-host in that case, so we
    // resolve the true target via composedPath() (dom.findInPath).
    mouseoverHandler = (e) => {
      if (disposed) return;
      const dom = window.BeePlus.dom;
      if (!dom) return;
      const el = dom.findInPath(e, isAvatarCandidate) || (isAvatarCandidate(e.target) ? e.target : null);
      if (!el) return;
      // Temporary debug: uncomment / toggle to trace hovers.
      // console.log("[BeePlus profile-hover] avatar hovered:", el.tagName, el.className);
      // Same avatar as active — but if hoverTimer isn't armed (e.g. an
      // intra-avatar mouseout just cancelled it and armed outTimer), we
      // must re-arm so the tooltip still gets shown.
      if (activeAvatar === el && hoverTimer) return;
      // Cancel any pending hide-after-mouseout — the pointer is still on
      // (or moved to) the same avatar; do not dismiss.
      clearTimeout(outTimer); outTimer = null;
      let uuids = api.extractUuidsFromDom(el);
      if (!uuids.length) {
        const fileUuid = api.resolveAvatarUuid(el);
        const userUuid = fileUuid ? api.avatarUuidToUserUuid(fileUuid) : null;
        if (userUuid) uuids = [userUuid];
      }
      // Silent fail — happens legitimately for the user's own navbar avatar
      // whose dropdown-toggle has href="#" and no UUID anywhere in its
      // ancestry. Don't spam the console (which Chrome flags as an
      // extension error) for a normal no-op.
      if (!uuids.length) return;
      activeAvatar = el;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        if (disposed) return;
        hoverTimer = null;
        renderTooltipMulti(el, uuids);
        attachScrollHiders(el);
      }, delay);
    };

    mouseoutHandler = (e) => {
      const dom = window.BeePlus.dom;
      if (!dom) return;
      // If the pointer is still on the same avatar (moved between the
      // avatar's own subtree elements — background, img, presence dot),
      // do NOT cancel the pending show or start the hide timer. This was
      // the /chats regression: intra-avatar mouseout cancelled hoverTimer
      // before it fired, so the tooltip never appeared.
      const stillOnAvatar = dom.findInPath(e, isAvatarCandidate);
      if (stillOnAvatar && stillOnAvatar === activeAvatar) return;
      clearTimeout(outTimer);
      outTimer = setTimeout(() => {
        if (disposed) return;
        outTimer = null;
        if (!tooltipEl || !tooltipEl.matches(":hover")) hideTooltip();
      }, 150);
    };

    scrollHandler = hideTooltip;
    clickHandler = hideTooltip;

    // Beekeeper's <beekeeper-chats-view> stops mouseover propagation inside
    // its shadow-root — a plain document-level listener silently misses
    // every chat-row avatar hover (light-DOM avatars on /my-home still
    // work because those events do reach document). Attach to document
    // AND to every shadow-root, keep attaching to new ones automatically.
    const dom = window.BeePlus.dom;
    if (dom && dom.addListenerAcrossShadows) {
      detachMouseover = dom.addListenerAcrossShadows("mouseover", mouseoverHandler, { capture: true });
      detachMouseout = dom.addListenerAcrossShadows("mouseout", mouseoutHandler, { capture: true });
    } else {
      document.addEventListener("mouseover", mouseoverHandler, true);
      document.addEventListener("mouseout", mouseoutHandler, true);
    }
    window.addEventListener("scroll", scrollHandler, true);
    document.addEventListener("click", clickHandler, true);
  }

  function teardown() {
    disposed = true;
    clearTimeout(hoverTimer);
    hoverTimer = null;
    clearTimeout(outTimer);
    outTimer = null;
    if (detachMouseover) { detachMouseover(); detachMouseover = null; }
    if (detachMouseout) { detachMouseout(); detachMouseout = null; }
    if (mouseoverHandler) document.removeEventListener("mouseover", mouseoverHandler, true);
    if (mouseoutHandler) document.removeEventListener("mouseout", mouseoutHandler, true);
    if (scrollHandler) window.removeEventListener("scroll", scrollHandler, true);
    if (clickHandler) document.removeEventListener("click", clickHandler, true);
    // Detach shadow-scroller listeners we may have attached during hovers.
    scrollTargets.forEach((el) => {
      try { el.removeEventListener("scroll", hideTooltip, { capture: true }); } catch (_) {}
    });
    scrollTargets.clear();
    hideTooltip();
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
    activeAvatar = null;
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
