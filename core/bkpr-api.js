// Shared Beekeeper API helper for all features.
// Handles CSRF token (from page-script via window.postMessage), auth headers,
// avatar-UUID -> user-UUID mapping, profile fetching with cache.

(function (root) {
  const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const CSRF_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_+/=-]{16,}$/;
  const CACHE_TTL_MS = 5 * 60 * 1000;

  let cachedCsrf = null;
  // Tokens the server has already told us are stale. Never trust a rescan
  // that hands one of these back — Beekeeper's Vuex/Backbone state keeps
  // the old value cached until the SPA itself refreshes it via its own
  // API traffic. Without this, invalidateCsrf() rescans window state,
  // gets the SAME token back, and the retry 400s immediately again.
  const invalidatedCsrf = new Set();
  const profileCache = new Map();
  const avatarToUser = new Map();
  const fieldLabelsCache = new Set();
  const collectedLabels = {};

  // Listener fuer page-script (MAIN world)
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "bkpr-ext") return;
    if (e.data.type === "csrf" && e.data.value && CSRF_PATTERN.test(e.data.value)) {
      // Ignore any token the server already told us is stale.
      if (invalidatedCsrf.has(e.data.value)) return;
      if (cachedCsrf !== e.data.value) {
        cachedCsrf = e.data.value;
        console.log("[BeePlus] CSRF received");
      }
    } else if (e.data.type === "avatarMap" && Array.isArray(e.data.entries)) {
      for (const [fileUuid, userUuid] of e.data.entries) {
        if (fileUuid && userUuid) avatarToUser.set(fileUuid, userUuid);
      }
    }
  });

  function bkprHeaders() {
    // NOTE (v1.2.21): no `Authorization` header. Beekeeper is
    // cookie-authenticated (credentials:"include" carries the session),
    // and the modern Web-Components frontend does NOT send an
    // Authorization header at all. Older builds sent
    // `Authorization: Cookie` as a sentinel value, which post-migration
    // edge validation now rejects with 400 (the error body happens to
    // mention "csrf", which misled our retry path into a loop of
    // resending a stale token).
    // Accept accepts both the vendor MIME (customfields v2) and plain
    // JSON so a future vendor-version bump doesn't 406 us.
    const h = {
      "accept": "application/vnd.io.beekeeper.customfields+json;version=2, application/json;q=0.9",
      "x-bkpr-app-name": "app-web",
      "x-requested-with": "XMLHttpRequest"
    };
    if (cachedCsrf) h["x-csrf-token"] = cachedCsrf;
    return h;
  }

  // Short wait — only briefly (300ms) on first request. User-perceived
  // latency must stay snappy. If CSRF is missing, try the request anyway
  // (some endpoints may work without). Treats an invalidated token as
  // "no token" so an invalidate-then-retry doesn't immediately return
  // the stale value.
  async function waitForCsrf(timeoutMs = 300) {
    const fresh = () => cachedCsrf && !invalidatedCsrf.has(cachedCsrf);
    if (fresh()) return cachedCsrf;
    const start = Date.now();
    while (!fresh() && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return cachedCsrf;
  }

  function userObj(data) {
    return (data && data.user) || data || {};
  }

  // Debounced dirty-flag flush. Two hazards addressed:
  //   1. `collectFieldLabels` used to write on every profile fetch — busy chat
  //      views hammered chrome.storage.local.
  //   2. With `all_frames:true` this content script runs in every iframe of
  //      the Beekeeper tab; every frame writes the same knownFields. Guard
  //      to top-frame only so the write happens once per tab.
  let flushTimer = null;
  let dirty = false;
  function scheduleFlush() {
    if (!dirty || flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (!dirty) return;
      dirty = false;
      if (window.top !== window) return; // only top-frame writes
      try {
        chrome.storage.local.set({
          knownFields: [...fieldLabelsCache],
          fieldLabels: collectedLabels
        });
      } catch (_) {}
    }, 800);
  }

  function collectFieldLabels(data) {
    const u = userObj(data);
    const prevSize = fieldLabelsCache.size;
    const prevLabelKeys = Object.keys(collectedLabels).length;
    Object.keys(u || {}).forEach((k) => {
      if (k !== "custom_fields" && k !== "avatar_versions") fieldLabelsCache.add(k);
    });
    const cf = u.custom_fields;
    if (Array.isArray(cf)) {
      cf.forEach((f) => {
        if (f.key) {
          fieldLabelsCache.add(`custom.${f.key}`);
          if (f.label) collectedLabels[`custom.${f.key}`] = f.label;
        }
      });
    }
    if (fieldLabelsCache.size !== prevSize || Object.keys(collectedLabels).length !== prevLabelKeys) {
      dirty = true;
      scheduleFlush();
    }
  }

  function invalidateCsrf() {
    // Remember what the server rejected so page-script's rescan and
    // subsequent fetch/XHR/jQuery hooks refuse to re-emit it.
    if (cachedCsrf) invalidatedCsrf.add(cachedCsrf);
    cachedCsrf = null;
    window.postMessage({
      source: "bkpr-ext",
      type: "rescan-csrf",
      exclude: [...invalidatedCsrf]
    }, "*");
  }

  async function fetchProfile(uuid, _retry) {
    const cached = profileCache.get(uuid);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
    await waitForCsrf();
    const res = await fetch(`/api/2/profiles/${uuid}`, {
      credentials: "include",
      headers: bkprHeaders()
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 400 with "csrf" in body → token stale; invalidate + wait for a
      // GENUINELY fresh token, then retry once. The 800ms sleep from
      // v1.2.19 wasn't long enough for Beekeeper's SPA to fire its own
      // heartbeat/API call, so our page-script had nothing new to
      // capture and the retry sent the same stale token again.
      // waitForCsrf (with the invalidatedCsrf guard) now blocks up to
      // 3s until page-script feeds us a token that's NOT on the
      // exclude list.
      if (res.status === 400 && /csrf/i.test(body) && !_retry) {
        console.log("[BeePlus] CSRF stale, invalidating + waiting for fresh token");
        invalidateCsrf();
        await waitForCsrf(3000);
        return fetchProfile(uuid, true);
      }
      // Log (not warn — Chrome flags warn as an extension-error and users
      // see a red badge for what is a normal per-user API refusal like
      // 404 on a deleted user or 403 for a hidden profile).
      console.log("[BeePlus] API error", res.status, "body:", body);
      throw new Error(`API ${res.status}`);
    }
    const data = await res.json();
    profileCache.set(uuid, { data, ts: Date.now() });
    collectFieldLabels(data);
    return data;
  }

  function resolveAvatarUuid(imgEl) {
    if (!imgEl || imgEl.tagName !== "IMG" || !imgEl.src) return null;
    const m = imgEl.src.match(UUID_REGEX);
    return m ? m[0] : null;
  }

  function avatarUuidToUserUuid(fileUuid) {
    return avatarToUser.get(fileUuid) || null;
  }

  function extractUuidsFromDom(el) {
    const found = new Set();
    let cur = el;
    let hops = 0;
    while (cur && cur !== document && cur !== document.body && cur !== document.documentElement && hops < 30) {
      if (cur.tagName === "A" && cur.href) {
        // Legacy paths (/profiles/UUID, /users/UUID) AND new Beekeeper
        // Web-Components path (/chats/user/UUID).
        const m = cur.href.match(/\/(?:profiles|users|chats\/user)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (m) found.add(m[1]);
      }
      for (const attr of cur.attributes || []) {
        if (!attr.name.startsWith("data-")) continue;
        const m = attr.value.match(UUID_REGEX);
        if (m) found.add(m[0]);
      }
      // Ascend through the DOM — cross shadow-DOM boundaries via the
      // root's `.host` so ancestries that span custom-element boundaries
      // still yield up their profile-links.
      let next = cur.parentElement;
      if (!next) {
        const rootNode = cur.getRootNode && cur.getRootNode();
        if (rootNode && rootNode.host) next = rootNode.host;
      }
      cur = next;
      hops++;
    }
    return [...found];
  }

  // Resolve a stored field key into a value from the profile data.
  function resolveField(data, key) {
    const u = userObj(data);
    if (key.startsWith("custom.")) {
      const sub = key.slice(7);
      const cf = u.custom_fields;
      if (!Array.isArray(cf)) return undefined;
      const found = cf.find((f) => f.key === sub);
      if (!found) return undefined;
      let v = found.value;
      if (found.type === "dropdown" && Array.isArray(found.options)) {
        const opt = found.options.find((o) => o.key === v);
        if (opt) v = opt.value;
      }
      if (found.type === "user_select" && v && typeof v === "object") {
        v = v.display_name || v.name || v.id;
      }
      if (Array.isArray(v)) {
        v = v.map((x) => (x && typeof x === "object" ? (x.display_name || x.name || x.id) : x)).join(", ");
      }
      if (found.type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, d] = v.split("-");
        v = `${d}.${m}.${y}`;
      }
      return v;
    }
    return u[key];
  }

  function resolveLabel(data, key) {
    if (key.startsWith("custom.")) {
      const sub = key.slice(7);
      const cf = userObj(data).custom_fields;
      if (Array.isArray(cf)) {
        const found = cf.find((f) => f.key === sub);
        if (found && found.label) return found.label;
      }
    }
    const map = {
      display_name: "Name",
      display_name_extension: "Position",
      name: "Username",
      username: "Username",
      firstname: "Vorname",
      lastname: "Nachname",
      first_name: "Vorname",
      last_name: "Nachname",
      role: "Rolle",
      created: "Erstellt",
      confirmed: "Bestaetigt",
      avatar: "Avatar"
    };
    const clean = key.replace(/^custom\./, "");
    return map[clean] || clean.replace(/_/g, " ");
  }

  root.BeePlus = root.BeePlus || {};
  root.BeePlus.api = {
    fetchProfile,
    resolveAvatarUuid,
    avatarUuidToUserUuid,
    extractUuidsFromDom,
    resolveField,
    resolveLabel,
    userObj,
    UUID_REGEX
  };
})(window);
