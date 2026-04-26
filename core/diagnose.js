// BeePlus diagnostic helper. Run BeePlus.diagnose() in the Beekeeper tab
// console to see which DOM selectors match. Helps fix selector drift.

(function (root) {
  function diagnose() {
    const SELECTORS = {
      "Chat-List rows": '[data-bkpr-id*="chat-list-item"], [data-bkpr-id*="conversation-item"], [data-bkpr-id*="stream-list-item"], .chat-list-item, .conversation-item, .stream-list-item',
      "Composer": '[data-bkpr-id="composer"], [data-bkpr-id="message-composer"], .bkpr-composer, .message-composer, [contenteditable="true"][data-bkpr-id*="composer"]',
      "Composer textarea": 'textarea[data-bkpr-id*="composer"], [contenteditable="true"][data-bkpr-id*="composer"], textarea.composer-input, .composer textarea, .composer [contenteditable="true"]',
      "Messages": '[data-bkpr-id="message"], [data-bkpr-id*="message-bubble"], .bkpr-message, .message-item',
      "Reactions": '[data-bkpr-id*="reaction"], .reaction-button, .emoji-reaction-btn',
      "Avatars": 'img[class*="avatar"], img[data-bkpr-id*="avatar"]'
    };
    const out = {};
    for (const [name, sel] of Object.entries(SELECTORS)) {
      const els = document.querySelectorAll(sel);
      out[name] = {
        count: els.length,
        firstHtml: els[0] ? els[0].outerHTML.slice(0, 300) + (els[0].outerHTML.length > 300 ? "..." : "") : null
      };
    }
    console.group("[BeePlus] DOM Diagnose");
    console.table(Object.entries(out).map(([k, v]) => ({ "Element": k, "Found": v.count })));
    for (const [name, v] of Object.entries(out)) {
      if (v.count === 0) console.warn(`❌ ${name}: 0 matches`);
      else console.log(`✅ ${name} (${v.count}): ${v.firstHtml}`);
    }
    console.groupEnd();
    return out;
  }

  // Auto-suggest selectors by scanning DOM for likely candidates.
  function suggestSelectors() {
    console.group("[BeePlus] Selector-Vorschläge");

    // Find likely chat list: <ul>/<div> with many similar children that contain UUIDs in href
    const candidates = document.querySelectorAll("ul, [role='list'], nav > div, aside > div");
    let bestList = null, bestCount = 0;
    candidates.forEach((c) => {
      const links = c.querySelectorAll('a[href*="/streams/"], a[href*="/chats/"], a[href*="/conversations/"]');
      if (links.length > bestCount) { bestCount = links.length; bestList = c; }
    });
    if (bestList) {
      console.log("📋 Chat-List Container:", bestList);
      console.log("   Selektor:", computeSelector(bestList));
      const child = bestList.querySelector("a, li, [class*='item']");
      if (child) {
        console.log("   Item-Selektor:", computeSelector(child));
        console.log("   Item-HTML:", child.outerHTML.slice(0, 400));
      }
    } else {
      console.warn("📋 Chat-List nicht gefunden");
    }

    // Composer: find first focusable textarea/contenteditable in lower 1/3 of viewport
    const inputs = [...document.querySelectorAll('textarea, [contenteditable="true"]')];
    const composerCandidates = inputs.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > window.innerHeight * 0.5 && r.width > 150;
    });
    if (composerCandidates.length) {
      const c = composerCandidates[composerCandidates.length - 1];
      console.log("✏️ Composer:", c);
      console.log("   Selektor:", computeSelector(c));
      console.log("   HTML:", c.outerHTML.slice(0, 400));
      console.log("   Parent:", c.parentElement?.outerHTML?.slice(0, 400));
    } else {
      console.warn("✏️ Composer nicht gefunden");
    }

    console.groupEnd();
  }

  function computeSelector(el) {
    if (!el) return "";
    if (el.id) return `#${el.id}`;
    const cls = (el.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 2);
    let sel = el.tagName.toLowerCase();
    if (cls.length) sel += "." + cls.join(".");
    // Add data-bkpr-id if present
    const bkpr = el.getAttribute && el.getAttribute("data-bkpr-id");
    if (bkpr) sel = `[data-bkpr-id="${bkpr}"]`;
    return sel;
  }

  root.BeePlus = root.BeePlus || {};
  root.BeePlus.diagnose = diagnose;
  root.BeePlus.suggestSelectors = suggestSelectors;
})(window);
