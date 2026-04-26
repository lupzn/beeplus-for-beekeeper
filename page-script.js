// Laeuft im MAIN-World-Kontext der Beekeeper-Seite.
// Hookt fetch + XMLHttpRequest, faengt CSRF-Token aus Beekeepers eigenen API-Requests
// und postet ihn an Content-Script via window.postMessage.

(() => {
  // Guard against double-injection (e.g. via chrome.scripting.executeScript)
  if (window.__bkprPageScriptLoaded) return;
  window.__bkprPageScriptLoaded = true;

  let lastCsrf = null;

  // Listen for rescan request from content-script (e.g. when API returns CSRF stale)
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "bkpr-ext") return;
    if (e.data.type === "rescan-csrf") {
      lastCsrf = null;
      console.log("[BeePlus] CSRF rescan requested");
      try {
        const found = scan(window, 0, new WeakSet());
        if (found) emitCsrf(found);
      } catch (_) {}
    }
  });

  function emitCsrf(token) {
    if (!token || token === lastCsrf) return;
    lastCsrf = token;
    window.postMessage({ source: "bkpr-ext", type: "csrf", value: token }, "*");
  }

  // Avatar-File-UUID -> User-UUID Map sammeln
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  function extractAvatarMap(obj, out = [], depth = 0, seen = new WeakSet()) {
    if (!obj || depth > 6 || typeof obj !== "object" || seen.has(obj)) return out;
    seen.add(obj);
    if (Array.isArray(obj)) {
      for (const item of obj) extractAvatarMap(item, out, depth + 1, seen);
      return out;
    }
    // Heuristik: Objekt hat User-UUID + Avatar-URL?
    const uid = obj.id || obj.user_id || obj.uuid;
    const av = obj.avatar || obj.profile_image || obj.avatar_url || obj.image;
    if (typeof uid === "string" && UUID_RE.test(uid)) {
      let avStr = null;
      if (typeof av === "string") avStr = av;
      else if (av && typeof av === "object") avStr = av.url || av.original || av.large || av.medium || av.small;
      if (avStr) {
        const m = avStr.match(UUID_RE);
        if (m && m[0] !== uid) out.push([m[0], uid]);
      }
    }
    for (const k in obj) {
      try { extractAvatarMap(obj[k], out, depth + 1, seen); } catch (_) {}
    }
    return out;
  }

  function emitMap(entries) {
    if (!entries.length) return;
    window.postMessage({ source: "bkpr-ext", type: "avatarMap", entries }, "*");
  }

  // fetch-Hook (handles 4 ways CSRF can be passed: init.headers, Request-object headers, init Headers, plain object)
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      // Headers can come from init.headers OR from a Request object passed as input.
      const sources = [];
      if (init?.headers) sources.push(init.headers);
      if (input && typeof input === "object" && input.headers) sources.push(input.headers);

      for (const headers of sources) {
        let v = null;
        if (headers instanceof Headers) {
          v = headers.get("x-csrf-token") || headers.get("X-CSRF-Token");
        } else if (Array.isArray(headers)) {
          const f = headers.find((h) => /^x-csrf-token$/i.test(h[0]));
          v = f ? f[1] : null;
        } else if (typeof headers === "object") {
          for (const k of Object.keys(headers)) {
            if (/^x-csrf-token$/i.test(k)) { v = headers[k]; break; }
          }
        }
        if (v) {
          console.log("[BeePlus] CSRF captured via fetch hook");
          emitCsrf(v);
        }
      }
    } catch (_) {}
    const promise = origFetch.apply(this, arguments);
    // Response sniffen (nur Beekeeper-API)
    promise.then((res) => {
      try {
        const url = (typeof input === "string" ? input : input?.url) || "";
        if (!/\/api\//.test(url)) return;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("json")) return;
        res.clone().json().then((data) => {
          const entries = extractAvatarMap(data);
          if (entries.length) emitMap(entries);
        }).catch(() => {});
      } catch (_) {}
    }).catch(() => {});
    return promise;
  };

  // XMLHttpRequest-Hook
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (/^x-csrf-token$/i.test(name)) emitCsrf(value);
    } catch (_) {}
    return origSetHeader.apply(this, arguments);
  };

  // Optional: scan window-State direkt nach bekanntem Pattern
  const PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_+/=-]{16,}$/;
  function scan(obj, depth, seen) {
    if (!obj || depth > 4 || seen.has(obj)) return null;
    if (typeof obj !== "object") return null;
    seen.add(obj);
    for (const k in obj) {
      try {
        const v = obj[k];
        if (typeof v === "string" && PATTERN.test(v)) return v;
        if (v && typeof v === "object") {
          const f = scan(v, depth + 1, seen);
          if (f) return f;
        }
      } catch (_) {}
    }
    return null;
  }
  // Periodischer Window-Scan + Backbone-Globals + bekannte SPA-State-Pfade.
  function periodicScan() {
    if (lastCsrf) return;
    // 1. Bekannte Beekeeper-Globals direkt prüfen
    const knownPaths = [
      "app", "App", "BEEKEEPER", "Beekeeper", "bkpr", "BKPR",
      "appState", "__INITIAL_STATE__", "store", "$store"
    ];
    for (const p of knownPaths) {
      try {
        const v = window[p];
        if (!v) continue;
        const found = scan(v, 0, new WeakSet());
        if (found) {
          console.log(`[BeePlus] CSRF via window.${p}`);
          emitCsrf(found);
          return;
        }
      } catch (_) {}
    }
    // 2. Generic deep window scan
    try {
      const found = scan(window, 0, new WeakSet());
      if (found) {
        console.log("[BeePlus] CSRF via window scan");
        emitCsrf(found);
      }
    } catch (_) {}
  }
  [300, 800, 1500, 3000, 5000, 8000, 12000, 20000, 30000].forEach((ms) => setTimeout(periodicScan, ms));

  // HTML-Scrape: ggf eingebettetes Token in Boot-HTML
  setTimeout(() => {
    if (lastCsrf) return;
    try {
      fetch("/", { credentials: "include" })
        .then((r) => r.text())
        .then((t) => {
          const m = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_+/=-]{16,}/);
          if (m) {
            console.log("[Beekeeper Profile Hover] CSRF via HTML-Scrape gefunden");
            emitCsrf(m[0]);
          }
        })
        .catch(() => {});
    } catch (_) {}
  }, 2000);

  // jQuery $.ajax Hook (Backbone benutzt jQuery)
  function hookJQuery() {
    const $ = window.jQuery || window.$;
    if (!$ || !$.ajaxSetup || $.__bkprHooked) return false;
    $.__bkprHooked = true;
    const origAjax = $.ajax;
    $.ajax = function (settingsOrUrl, settings) {
      const opts = typeof settingsOrUrl === "string" ? settings || {} : settingsOrUrl || {};
      try {
        const h = opts.headers;
        if (h) {
          const v = h["x-csrf-token"] || h["X-CSRF-Token"] || h["X-Csrf-Token"];
          if (v) emitCsrf(v);
        }
        const origBeforeSend = opts.beforeSend;
        opts.beforeSend = function (xhr, s) {
          try {
            // Wrappe setRequestHeader damit jQuery's interne Calls auch erfasst werden
            const origSet = xhr.setRequestHeader.bind(xhr);
            xhr.setRequestHeader = function (n, v) {
              if (/^x-csrf-token$/i.test(n)) emitCsrf(v);
              return origSet(n, v);
            };
          } catch (_) {}
          if (typeof origBeforeSend === "function") return origBeforeSend.call(this, xhr, s);
        };
      } catch (_) {}
      return origAjax.apply(this, arguments);
    };
    console.log("[Beekeeper Profile Hover] jQuery.ajax gehookt");
    return true;
  }
  // jQuery wird spaeter geladen, daher poll
  const jqInterval = setInterval(() => {
    if (hookJQuery() || lastCsrf) clearInterval(jqInterval);
  }, 200);
  setTimeout(() => clearInterval(jqInterval), 30000);

  console.log("[Beekeeper Profile Hover] page-script geladen (MAIN world)");
})();
