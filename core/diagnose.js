// BeePlus diagnostic helper. Run BeePlus.diagnose() in the Beekeeper tab
// console to see which DOM selectors match. Helps fix selector drift.
//
// v1.2.20: Beekeeper migrated to Web-Components with Shadow-DOM. All
// selector counts use the shadow-piercing helper so `BeePlus.diagnose()`
// sees what actually lives inside <BEEKEEPER-CHATS-VIEW> etc.

(function (root) {
  function shadowQuerySelectorAllFallback(sel) {
    const results = [];
    const seen = new WeakSet();
    function walk(node) {
      if (!node || seen.has(node)) return;
      seen.add(node);
      if (typeof node.querySelectorAll === "function") {
        try { results.push(...node.querySelectorAll(sel)); } catch (_) {}
        try {
          node.querySelectorAll("*").forEach((el) => {
            if (el.shadowRoot) walk(el.shadowRoot);
          });
        } catch (_) {}
      }
    }
    walk(document);
    return results;
  }

  function shadowAll(sel) {
    const dom = root.BeePlus && root.BeePlus.dom;
    if (dom && dom.shadowQuerySelectorAll) return dom.shadowQuerySelectorAll(sel);
    return shadowQuerySelectorAllFallback(sel);
  }

  function diagnose() {
    const SELECTORS = {
      "Chat-List rows (legacy)": '[data-bkpr-id*="chat-list-item"], [data-bkpr-id*="conversation-item"], [data-bkpr-id*="stream-list-item"], .chat-list-item, .conversation-item, .stream-list-item',
      "Chat-List rows (Beekeeper v2)": '[data-bkpr-id="inbox-list-item"]',
      "Chat-List container": '[data-bkpr-id="inbox-list"], .inbox-list, .infinite-scrolling',
      "Composer (legacy)": '[data-bkpr-id="composer"], [data-bkpr-id="message-composer"], .bkpr-composer, .message-composer',
      "Composer textarea (any)": 'textarea, [contenteditable="true"]',
      "Messages (legacy)": '[data-bkpr-id="message"], [data-bkpr-id*="message-bubble"], .bkpr-message, .message-item',
      "Messages (Beekeeper v2)": '[data-bkpr-id*="chat-message"]',
      "Reactions": '[data-bkpr-id*="reaction"], .reaction-button, .emoji-reaction-btn',
      "Avatars": 'img[class*="avatar"], img[data-bkpr-id*="avatar"]',
      "Web-Component: chats-view": "beekeeper-chats-view",
      "Web-Component: native-bk-textarea": "native-bk-textarea, native-bk-textarea-1-14-0"
    };
    const out = {};
    for (const [name, sel] of Object.entries(SELECTORS)) {
      const els = shadowAll(sel);
      out[name] = {
        count: els.length,
        firstHtml: els[0] ? els[0].outerHTML.slice(0, 300) + (els[0].outerHTML.length > 300 ? "..." : "") : null
      };
    }
    // Shadow-DOM summary — walk recursively into shadow-roots so nested
    // hosts (a shadow-root that contains further custom elements with their
    // own shadowRoots) are reported. A plain document.querySelectorAll('*')
    // only reaches light-DOM hosts.
    const shadowHosts = [];
    const visitedRoots = new WeakSet();
    (function collect(root) {
      if (!root || visitedRoots.has(root)) return;
      visitedRoots.add(root);
      if (typeof root.querySelectorAll !== "function") return;
      try {
        root.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot) {
            shadowHosts.push(el);
            collect(el.shadowRoot);
          }
        });
      } catch (_) {}
    })(document);
    const hostSummary = shadowHosts.reduce((acc, el) => {
      const key = el.tagName;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    console.group("[BeePlus] DOM Diagnose (v1.2.20 — shadow-piercing)");
    console.table(Object.entries(out).map(([k, v]) => ({ "Element": k, "Found (incl. Shadow)": v.count })));
    for (const [name, v] of Object.entries(out)) {
      if (v.count === 0) console.warn(`❌ ${name}: 0 matches`);
      else console.log(`✅ ${name} (${v.count}): ${v.firstHtml}`);
    }
    console.log("--- Shadow-DOM hosts ---");
    console.table(Object.entries(hostSummary).map(([tag, count]) => ({ HostTag: tag, Count: count })));
    console.groupEnd();
    return out;
  }

  // Auto-suggest selectors by scanning DOM for likely candidates.
  function suggestSelectors() {
    console.group("[BeePlus] Selector-Vorschläge");

    // Find likely chat list: <ul>/<div> with many similar children that contain UUIDs in href
    // Shadow-piercing to also see it inside <BEEKEEPER-CHATS-VIEW>.
    // scoped shadow-piercing helper: descend through the container AND any
    // shadowRoots it contains looking for a selector. Needed because
    // container.querySelectorAll only sees the container's own light-DOM
    // and would miss items that live behind a nested shadow.
    function scopedShadowAll(root, sel) {
      const results = [];
      const seen = new WeakSet();
      (function walk(node) {
        if (!node || seen.has(node)) return;
        seen.add(node);
        if (typeof node.querySelectorAll !== "function") return;
        try { results.push(...node.querySelectorAll(sel)); } catch (_) {}
        try {
          node.querySelectorAll("*").forEach((el) => {
            if (el.shadowRoot) walk(el.shadowRoot);
          });
        } catch (_) {}
      })(root);
      return results;
    }
    const listContainers = shadowAll("ul, [role='list'], nav > div, aside > div, .inbox-list, .infinite-scrolling");
    let bestList = null, bestCount = 0;
    listContainers.forEach((c) => {
      const links = scopedShadowAll(c, 'a[href*="/streams/"], a[href*="/chats/"], a[href*="/conversations/"], [data-bkpr-id="inbox-list-item"]');
      if (links.length > bestCount) { bestCount = links.length; bestList = c; }
    });
    if (bestList) {
      console.log("📋 Chat-List Container:", bestList);
      console.log("   Selektor:", computeSelector(bestList));
      const child = scopedShadowAll(bestList, "a, li, [data-bkpr-id='inbox-list-item'], [class*='item']")[0];
      if (child) {
        console.log("   Item-Selektor:", computeSelector(child));
        console.log("   Item-HTML:", child.outerHTML.slice(0, 400));
      }
    } else {
      console.warn("📋 Chat-List nicht gefunden");
    }

    // Composer: find first focusable textarea/contenteditable in lower 1/3 of viewport
    const inputs = shadowAll('textarea, [contenteditable="true"]');
    const composerCandidates = inputs.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > window.innerHeight * 0.5 && r.width > 150;
    });
    if (composerCandidates.length) {
      const c = composerCandidates[composerCandidates.length - 1];
      console.log("✏️ Composer:", c);
      console.log("   Selektor:", computeSelector(c));
      console.log("   HTML:", c.outerHTML.slice(0, 400));
      console.log("   Parent:", c.parentElement && c.parentElement.outerHTML && c.parentElement.outerHTML.slice(0, 400));
      console.log("   In Shadow-DOM?", c.getRootNode() !== document);
    } else {
      console.warn("✏️ Composer nicht gefunden");
    }

    console.groupEnd();
  }

  function computeSelector(el) {
    if (!el) return "";
    if (el.id) return `#${el.id}`;
    // SVG elements expose className as an SVGAnimatedString whose .toString()
    // returns "[object SVGAnimatedString]" in some engines — poisons the
    // selector. Prefer classList (always a DOMTokenList) when available.
    const classes = el.classList
      ? [...el.classList]
      : (el.className || "").toString().split(/\s+/);
    const cls = classes.filter(Boolean).slice(0, 2);
    let sel = el.tagName ? el.tagName.toLowerCase() : "";
    if (cls.length) sel += "." + cls.join(".");
    const bkpr = el.getAttribute && el.getAttribute("data-bkpr-id");
    if (bkpr) sel = `[data-bkpr-id="${bkpr}"]`;
    return sel;
  }

  root.BeePlus = root.BeePlus || {};
  root.BeePlus.diagnose = diagnose;
  root.BeePlus.suggestSelectors = suggestSelectors;
})(window);
