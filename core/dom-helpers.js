// Shared DOM helpers across BeePlus features.
// Beekeeper migrated to Web Components with Shadow-DOM (v1.2.20):
// <BEEKEEPER-CHATS-VIEW>, <NATIVE-BK-*>. Elements like the chat-list live
// INSIDE shadow-roots — normal document.querySelector cannot see them.
// All lookup helpers below pierce shadow-roots.

(function (root) {
  // Recursive shadow-piercing querySelectorAll.
  // Walks the light-DOM tree and every shadowRoot it encounters.
  function shadowQuerySelectorAll(selector, scope) {
    scope = scope || document;
    const results = [];
    const seen = new WeakSet();
    function walk(node) {
      if (!node || seen.has(node)) return;
      seen.add(node);
      if (typeof node.querySelectorAll === "function") {
        try { results.push(...node.querySelectorAll(selector)); } catch (_) {}
        try {
          node.querySelectorAll("*").forEach((el) => {
            if (el.shadowRoot) walk(el.shadowRoot);
          });
        } catch (_) {}
      }
    }
    walk(scope);
    return results;
  }

  function shadowQuerySelector(selector, scope) {
    return shadowQuerySelectorAll(selector, scope)[0] || null;
  }

  // Composed-path helper — returns the first element in an event's real
  // path that matches the selector. Necessary because event.target is
  // retargeted to the shadow-host when the true target is inside a shadow.
  function findInPath(event, matchFn) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const el of path) {
      if (el && el.nodeType === 1) {
        try { if (matchFn(el)) return el; } catch (_) {}
      }
    }
    return null;
  }

  // Collect every reachable shadowRoot in the document.
  function collectAllShadowRoots() {
    const roots = [];
    const seen = new WeakSet();
    function walk(node) {
      if (!node || seen.has(node)) return;
      seen.add(node);
      if (!node.querySelectorAll) return;
      try {
        node.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot) { roots.push(el.shadowRoot); walk(el.shadowRoot); }
        });
      } catch (_) {}
    }
    walk(document);
    return roots;
  }

  // Attach an event listener on `document` AND on every shadowRoot in the
  // page, and — crucially — keep attaching to new shadow-roots as they
  // appear. Beekeeper's <beekeeper-chats-view> stops mouseover/click
  // propagation inside its shadow-root, so a document-only listener
  // silently misses every chat-row event. Returns a detach function.
  //
  // The same handler fires at most ONCE per event because the event goes
  // shadow-root capture → document capture; we dedupe by tagging the
  // event with a per-listener symbol.
  function addListenerAcrossShadows(type, handler, opts) {
    opts = opts || { capture: true };
    const attached = new WeakSet();
    const tag = Symbol(`bkpr-${type}-${Math.random()}`);
    const wrapped = (e) => {
      if (e[tag]) return; // already dispatched to this handler
      e[tag] = true;
      handler(e);
    };
    function attachTo(target) {
      if (!target || attached.has(target)) return;
      attached.add(target);
      try { target.addEventListener(type, wrapped, opts); } catch (_) {}
    }
    attachTo(document);
    for (const root of collectAllShadowRoots()) attachTo(root);
    // Observe for future shadow-roots — reuses observe() which itself is
    // shadow-aware. On every mutation batch, discover any new shadow-roots
    // that weren't seen before and attach the wrapper to them too.
    const stopObserver = observe(document.body, { childList: true, subtree: true }, () => {
      for (const root of collectAllShadowRoots()) attachTo(root);
    });
    return () => {
      stopObserver();
      // The WeakSet + wrapped closure means we cannot iterate targets
      // directly. Since each ShadowRoot is per-frame and short-lived
      // once its custom element unmounts, letting them GC is fine.
      // For document we detach explicitly.
      try { document.removeEventListener(type, wrapped, opts); } catch (_) {}
    };
  }

  // Walk an element's ancestry, crossing shadow-boundaries via .host so
  // callers can look at parent chains that span shadow-DOM.
  //
  // Caveat: a shadowRoot opened in `mode: "closed"` has host === null when
  // accessed from outside — the walk stops at the shadow boundary in that
  // case. Beekeeper currently uses open mode (verified live via
  // `.shadowRoot` access), so this is a theoretical concern only.
  function ancestorsCrossingShadow(el, limit) {
    limit = limit || 30;
    const out = [];
    let cur = el;
    let i = 0;
    while (cur && i < limit) {
      out.push(cur);
      let next = cur.parentElement;
      if (!next) {
        // Might be at a shadow-root boundary — cross via .host
        const rootNode = cur.getRootNode && cur.getRootNode();
        if (rootNode && rootNode.host) next = rootNode.host;
      }
      cur = next;
      i++;
    }
    return out;
  }

  // Beekeeper-specific finders. Combine legacy and new Shadow-DOM selectors
  // so the extension keeps working across Beekeeper versions.
  const CHAT_LIST_SEL = [
    '[data-bkpr-id="chat-list"]',
    '[data-bkpr-id="streams-list"]',
    '[data-bkpr-id="conversations-list"]',
    '[data-bkpr-id="inbox-list"]',
    '[data-bkpr-id*="inbox-list-conversations"]',
    ".bkpr-chat-list",
    ".conversation-list",
    ".inbox-list",
    ".infinite-scrolling",
    "nav .stream-list"
  ].join(",");

  const COMPOSER_SEL = [
    '[data-bkpr-id="composer"]',
    '[data-bkpr-id="message-composer"]',
    '[data-bkpr-id="chat-composer"]',
    ".bkpr-composer",
    ".message-composer",
    '[contenteditable="true"][data-bkpr-id*="composer"]'
  ].join(",");

  const COMPOSER_TEXTAREA_SEL = [
    'textarea[data-bkpr-id*="composer"]',
    '[contenteditable="true"][data-bkpr-id*="composer"]',
    "textarea.composer-input",
    ".composer textarea",
    '.composer [contenteditable="true"]',
    // Web-Components names
    "native-bk-textarea-1-14-0 textarea",
    "native-bk-textarea textarea"
  ].join(",");

  const MESSAGE_SEL = [
    '[data-bkpr-id="message"]',
    '[data-bkpr-id*="message-bubble"]',
    '[data-bkpr-id*="chat-message"]',
    ".bkpr-message",
    ".message-item",
    // Web-Components tag names appear as *elements*, matched via wildcard.
    // Fallback: broad class match handled downstream.
  ].join(",");

  function findChatList() {
    return shadowQuerySelector(CHAT_LIST_SEL);
  }

  function findComposer() {
    return shadowQuerySelector(COMPOSER_SEL);
  }

  function findComposerTextarea(scope) {
    return shadowQuerySelector(COMPOSER_TEXTAREA_SEL, scope || document);
  }

  function findMessages() {
    return shadowQuerySelectorAll(MESSAGE_SEL);
  }

  // Wait until selector matches in DOM (or timeout). Returns element or null.
  function waitFor(selectorFn, timeoutMs) {
    timeoutMs = timeoutMs || 10000;
    return new Promise((resolve) => {
      const start = Date.now();
      const t = setInterval(() => {
        const el = selectorFn();
        if (el) { clearInterval(t); resolve(el); }
        else if (Date.now() - start > timeoutMs) { clearInterval(t); resolve(null); }
      }, 200);
    });
  }

  // MutationObserver that also observes every shadow-root reachable from
  // `target`, and starts observing new shadow-roots as they appear.
  // Callback signature matches native MO: (mutations, observer).
  //
  // Two subtleties Beekeeper's Web-Components force us to handle:
  //   1. MutationObserver does NOT fire when Element.attachShadow() is called
  //      on an already-existing element (attachShadow is not a tree mutation).
  //      → On every mutation batch we re-run the shadow-host walk so a
  //        lazily-attached shadowRoot on a long-lived element is still caught.
  //      → The observedRoots WeakSet dedupes so this is cheap.
  //   2. When a new shadowRoot is discovered we must recurse INTO it to catch
  //      any nested shadow-roots already present at attach time (Beekeeper
  //      nests <BEEKEEPER-CHATS-VIEW> → <NATIVE-BK-PANEL> → …). Otherwise
  //      inner shadows are only observed after their own tree mutates.
  function observe(target, opts, cb) {
    const observers = [];
    const observedRoots = new WeakSet();
    // Force subtree:true for shadowRoot observers: a caller who set
    // subtree:false on the top root would otherwise miss all deep-shadow
    // mutations even when they intended to observe them (Beekeeper's tree
    // is deeply nested).
    const shadowOpts = Object.assign({}, opts, { subtree: true });

    function walkShadowsFrom(node) {
      // Recursively find every shadowRoot reachable from `node`, including
      // the ones INSIDE freshly-attached shadowRoots. `attachToRoot` is
      // idempotent (WeakSet-guarded) so re-visits are free.
      if (!node) return;
      if (node.nodeType === 1 && node.shadowRoot) attachToRoot(node.shadowRoot);
      try {
        if (node.querySelectorAll) {
          node.querySelectorAll("*").forEach((el) => {
            if (el.shadowRoot) attachToRoot(el.shadowRoot);
          });
        }
      } catch (_) {}
    }

    // Throttle the full re-scan — the walk is per-tree-under-root and can
    // hit thousands of nodes on busy chat views. addedNodes coverage above
    // is enough for the common case; the full re-scan exists ONLY to catch
    // Element.attachShadow() on already-existing elements (which does not
    // fire a MutationObserver event). 500ms is a good tradeoff — well
    // below any user-visible delay, but keeps per-frame cost small during
    // Beekeeper's mutation storms (typing, virtual-scroll, message stream).
    let lastFullScan = 0;

    function attachToRoot(root) {
      if (!root || observedRoots.has(root)) return;
      observedRoots.add(root);
      const isShadowRoot = !!root.host;
      const mo = new MutationObserver((mutations) => {
        // Discover new shadow-roots via added nodes.
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length) {
            for (const node of m.addedNodes) {
              if (node.nodeType !== 1) continue;
              walkShadowsFrom(node);
            }
          }
        }
        // Additionally run a throttled full re-scan on EVERY mutation batch
        // (throttled to once per 500ms). This catches Element.attachShadow()
        // calls on already-existing elements — attachShadow() produces no
        // MutationObserver event of its own, and a busy SPA delivers
        // addedNodes-containing batches continuously, so gating the
        // full-scan on !sawAddedNodes would starve it forever in Beekeeper.
        const now = Date.now();
        if (now - lastFullScan > 500) {
          lastFullScan = now;
          walkShadowsFrom(root);
        }
        try { cb(mutations); } catch (_) {}
      });
      try {
        mo.observe(root, isShadowRoot ? shadowOpts : opts);
        observers.push(mo);
      } catch (_) {}
      // Recurse into this root to attach observers for every nested shadowRoot
      // present RIGHT NOW (initial descent).
      walkShadowsFrom(root);
    }

    attachToRoot(target);
    return () => observers.forEach((o) => { try { o.disconnect(); } catch (_) {} });
  }

  // Insert HTML element near another (after).
  function insertAfter(newEl, refEl) {
    if (refEl.nextSibling) refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
    else refEl.parentNode.appendChild(newEl);
  }

  // Trigger native input event (Vue/React listen to this).
  // Uses the prototype's value setter so frameworks see the change.
  function triggerInput(el, value) {
    if (el.tagName === "TEXTAREA") {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    } else if (el.tagName === "INPUT") {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    } else if (el.isContentEditable) {
      el.textContent = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function downloadJson(filename, data) {
    downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  }

  function downloadCsv(filename, rows) {
    const escape = (v) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
    downloadBlob(filename, new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  }

  root.BeePlus = root.BeePlus || {};
  root.BeePlus.dom = {
    // Shadow-DOM primitives
    shadowQuerySelectorAll,
    shadowQuerySelector,
    findInPath,
    ancestorsCrossingShadow,
    collectAllShadowRoots,
    addListenerAcrossShadows,
    // Legacy helpers (now shadow-piercing internally)
    findChatList,
    findComposer,
    findComposerTextarea,
    findMessages,
    waitFor,
    observe,
    insertAfter,
    triggerInput,
    downloadBlob,
    downloadJson,
    downloadCsv
  };
})(window);
