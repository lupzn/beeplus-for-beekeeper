// Shared Beekeeper API helper for all features.
// Handles CSRF token (from page-script via window.postMessage), auth headers,
// avatar-UUID -> user-UUID mapping, profile fetching with cache.

(function (root) {
  const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const CSRF_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_+/=-]{16,}$/;
  const CACHE_TTL_MS = 5 * 60 * 1000;

  let cachedCsrf = null;
  const profileCache = new Map();
  const avatarToUser = new Map();
  const fieldLabelsCache = new Set();
  const collectedLabels = {};

  // Listener fuer page-script (MAIN world)
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "bkpr-ext") return;
    if (e.data.type === "csrf" && e.data.value && CSRF_PATTERN.test(e.data.value)) {
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
    const h = {
      "accept": "application/vnd.io.beekeeper.customfields+json;version=2",
      "authorization": "Cookie",
      "x-bkpr-app-name": "app-web",
      "x-requested-with": "XMLHttpRequest"
    };
    if (cachedCsrf) h["x-csrf-token"] = cachedCsrf;
    return h;
  }

  // Short wait — only briefly (300ms). User-perceived latency must stay snappy.
  // If CSRF is missing, try the request anyway (some endpoints may work without).
  async function waitForCsrf(timeoutMs = 300) {
    if (cachedCsrf) return cachedCsrf;
    const start = Date.now();
    while (!cachedCsrf && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return cachedCsrf;
  }

  function userObj(data) {
    return (data && data.user) || data || {};
  }

  function collectFieldLabels(data) {
    const u = userObj(data);
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
    chrome.storage.local.set({
      knownFields: [...fieldLabelsCache],
      fieldLabels: collectedLabels
    });
  }

  function invalidateCsrf() {
    cachedCsrf = null;
    // Ask page-script to re-scan its window for a fresh token.
    window.postMessage({ source: "bkpr-ext", type: "rescan-csrf" }, "*");
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
      // 400 with "csrf" in body → token stale; invalidate + retry once silently
      if (res.status === 400 && /csrf/i.test(body) && !_retry) {
        console.log("[BeePlus] CSRF stale, invalidating + retrying");
        invalidateCsrf();
        await new Promise((r) => setTimeout(r, 800));
        return fetchProfile(uuid, true);
      }
      // Only warn on terminal failures
      console.warn("[BeePlus] API error", res.status, "body:", body);
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
    while (cur && cur !== document.body) {
      if (cur.tagName === "A" && cur.href) {
        const m = cur.href.match(/\/(?:profiles|users)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (m) found.add(m[1]);
      }
      for (const attr of cur.attributes || []) {
        if (!attr.name.startsWith("data-")) continue;
        const m = attr.value.match(UUID_REGEX);
        if (m) found.add(m[0]);
      }
      cur = cur.parentElement;
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
