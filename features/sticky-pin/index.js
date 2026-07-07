// Feature: Sticky Pin — keep selected chats at the top of the chat list.
// Strategy: idempotent DOM-move (insertBefore to first position) as the
// primary mechanism — works in any layout (block, flex, grid, contents).
// We additionally set `order: -1` and try to make the parent flex, which
// is a cheaper CSS-only path when Beekeeper's container already supports
// flex; if not, the DOM-move covers us. Re-renders by Beekeeper trigger
// a debounced re-scan via MutationObserver, which re-applies the order.

(function () {
  const SETTINGS_KEY = "feature.stickyPin";
  const DEFAULTS = { pinnedIds: [] };
  // Chat-row detection — combine legacy `<a href>` chat/stream links with
  // the new Beekeeper Web-Components layout where rows carry
  // `data-bkpr-id="inbox-list-item"` (still <a> under the hood).
  const LINK_SEL = [
    'a[href*="/streams/"]',
    'a[href*="/chats/"]',
    'a[href*="/conversations/"]',
    'a[href*="/inbox/"]',
    '[data-bkpr-id="inbox-list-item"]'
  ].join(",");
  const UUID_REGEX = window.BeePlus.api.UUID_REGEX;

  let teardownObserver = null;
  let pinned = new Set();
  let scanTimer = null;
  let safetyNetTimer = null;
  // Set true by teardown() — checked by async preRender loop, observer
  // callbacks, and safety-net interval so callbacks that already queued
  // before teardown do not re-decorate rows after cleanup.
  let disposed = false;

  // Verbose logging is opt-in. Enable by running this once in the
  // page console (or via the diagnose() helper):
  //   localStorage.setItem("bkpr.debug.stickyPin", "1")
  // Then reload the Beekeeper tab. End users see no console spam.
  const DEBUG = (() => {
    try { return localStorage.getItem("bkpr.debug.stickyPin") === "1"; }
    catch (_) { return false; }
  })();
  function dbg(...args) { if (DEBUG) console.log("[BeePlus sticky-pin]", ...args); }

  // Selectors for containers the feature MUST stay out of: admin tables and
  // modals/popovers/details panels.
  //
  // NOTE: We deliberately do NOT exclude classes like [class*="message"] or
  // [class*="bubble"] anymore — they were too broad and matched legitimate
  // sidebar chat-list ancestors (e.g. last-message-preview wrappers), which
  // caused pinned chats to lose their fixed position after a reload. Open
  // chat-panel links are filtered out by the position + height heuristic in
  // scanRows() instead.
  const EXCLUDE_ANCESTOR_SEL = [
    // Modals / popovers / dialogs
    '[role="dialog"]', '[aria-modal="true"]', 'dialog',
    '[class*="modal"]', '[class*="dialog"]', '[class*="popover"]',
    '[class*="popup"]', '[class*="details"]',
    '[class*="participants"]', '[class*="members"]',
    // Tables / grids (admin dashboard)
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    '[role="table"]', '[role="grid"]', '[role="row"]', '[role="rowgroup"]',
    // Composer + open thread view (these wrap the message editor itself)
    '[class*="composer"]', '[class*="thread-view"]'
  ].join(',');

  async function loadPinned() {
    const got = await chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULTS });
    pinned = new Set((got[SETTINGS_KEY] && got[SETTINGS_KEY].pinnedIds) || []);
  }

  async function savePinned() {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { pinnedIds: [...pinned] } });
  }

  function findRowFromLink(linkEl) {
    // Hard skip: link sits inside an admin table, a modal, or a chat-details
    // panel. These all contain stream/chat URLs but are not the chat list.
    if (linkEl.closest && linkEl.closest(EXCLUDE_ANCESTOR_SEL)) return null;

    // New Beekeeper layout: the <a> element itself IS the row and carries
    // data-bkpr-id="inbox-list-item". In that case return it directly.
    if (linkEl.getAttribute && linkEl.getAttribute("data-bkpr-id") === "inbox-list-item") {
      return linkEl;
    }

    // Word-boundary regex so we match "chat-list-item" but NOT "chat-list"
    // (which is the container). Without this we kept returning the whole
    // list as the "row" and rejecting it as tooTall.
    const ROW_CLASS_RE = /(?:^|[\s_-])(item|row|entry)(?:[\s_-]|$)/i;

    let cur = linkEl;
    for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
      // Stop climbing once we pass a typical chat-row height — anything
      // taller is a list container, not a single row.
      const h = cur.getBoundingClientRect().height;
      if (h > 250) break;
      if (cur.tagName === "LI") return cur;
      const cls = (cur.className || "").toString();
      if (ROW_CLASS_RE.test(cls) && cur !== linkEl) return cur;
      cur = cur.parentElement;
    }
    return (linkEl.closest && linkEl.closest("li")) || linkEl.parentElement || linkEl;
  }

  function extractUuidFromLink(linkEl) {
    // Prefer href, fall back to any data-* attribute or the element's own
    // ID — new Beekeeper rows sometimes lack an href but carry a data-uuid.
    const href = linkEl.getAttribute && linkEl.getAttribute("href");
    if (href) {
      const m = href.match(UUID_REGEX);
      if (m) return m[0];
    }
    for (const attr of (linkEl.attributes || [])) {
      if (!attr.name || !attr.name.startsWith("data-")) continue;
      const m = attr.value.match(UUID_REGEX);
      if (m) return m[0];
    }
    return null;
  }

  function ensureFlexParent(parent) {
    if (!parent) return;
    // Defensive: never force flex on table-display or grid parents — that's
    // exactly what nuked the admin dashboard table rows.
    const tag = parent.tagName;
    if (tag === "TABLE" || tag === "THEAD" || tag === "TBODY" || tag === "TR") return;
    const cs = window.getComputedStyle(parent);
    const display = cs.display;
    if (display.indexOf("table") === 0 || display === "grid" || display === "inline-grid" || display === "contents") return;
    // Light-DOM path: mark the parent — CSS `:has()` rule (in injectCss)
    // applies flex ONLY when the parent contains an actually-pinned row.
    parent.classList.add("bkpr-pin-flex-parent");
    // Shadow-DOM path: the document.head <style> does NOT pierce
    // <BEEKEEPER-CHATS-VIEW>'s shadow-root, so the :has() rule is dead
    // in there. Set `display: flex; flex-direction: column` inline on the
    // parent so `order: -1` on pinned rows actually moves them to the top.
    // Guarded by `pinned-rows-present` in applyPinState so an empty parent
    // is never forced into flex needlessly.
    const rootNode = parent.getRootNode && parent.getRootNode();
    if (rootNode && rootNode.host) {
      parent.dataset.bkprShadowFlexHost = "1";
    }
  }

  // Sync inline flex on a shadow-hosted element based on whether any
  // pinned row is currently inside it. Called with the chat-list container
  // (not the per-row wrapper): the wrapper contains one child by design,
  // so making the wrapper flex does nothing visible — the chat-list is
  // where ordering actually matters.
  //
  // Works only for elements whose root is a ShadowRoot — global CSS at
  // document.head does NOT pierce shadow-DOM, so we set inline styles.
  // For light-DOM containers, the `.bkpr-pin-flex-parent:has(...)` rule
  // in injectCss() handles the same job.
  function syncShadowFlex(container) {
    if (!container) return;
    const rootNode = container.getRootNode && container.getRootNode();
    if (!rootNode || !rootNode.host) return; // light-DOM — CSS rule covers it
    const hasPinnedDescendant = !!container.querySelector('.bkpr-pinned-row');
    if (hasPinnedDescendant) {
      container.style.setProperty("display", "flex", "important");
      container.style.setProperty("flex-direction", "column", "important");
      container.dataset.bkprShadowFlexHost = "1";
    } else if (container.dataset.bkprShadowFlexHost === "1") {
      delete container.dataset.bkprShadowFlexHost;
      container.style.removeProperty("display");
      container.style.removeProperty("flex-direction");
    }
  }

  function applyPinState(row, isPinned) {
    if (isPinned) {
      row.classList.add("bkpr-pinned-row");
      row.style.setProperty("order", "-1", "important");
      // Global <style> at document.head does NOT pierce shadow-DOM; set
      // the highlight inline so it applies inside <BEEKEEPER-CHATS-VIEW>
      // too. Small styles, safe to set repeatedly (idempotent).
      row.style.setProperty("background-color", "rgba(245, 158, 11, 0.06)", "important");
      row.style.setProperty("border-left", "3px solid #f59e0b", "important");
    } else {
      row.classList.remove("bkpr-pinned-row");
      row.style.removeProperty("order");
      row.style.removeProperty("background-color");
      row.style.removeProperty("border-left");
      // Don't try to restore original position — Beekeeper will resort
      // its list on the next data update / interaction.
    }
    // If the parent is a shadow-DOM host, sync its inline flex so `order:-1`
    // actually takes effect (or gets cleared when no pinned child remains).
    syncShadowFlex(row.parentElement);
  }

  // Ensure a persistent "pinned tray" element that lives ABOVE the
  // virtual-scroller chat-list. The tray is outside Vue's v-for so Vue
  // never touches it — pinned chats live here as CLONES of the originals.
  // The originals inside the virtual scroller are hidden.
  //
  // Why this over DOM-move + order? Beekeeper's inbox-list is a virtual
  // scroller: rows are absolutely positioned via `transform: translateY`
  // per virtual index. That defeats every ordering mechanism we tried —
  // flexbox ignores absolute children, `order` doesn't apply, and
  // insertBefore is overridden by Vue re-applying the transform. The
  // ONLY reliable option is to render pinned chats in our own container.
  function ensurePinnedTray(list) {
    const parent = list.parentElement;
    if (!parent) return null;
    let tray = parent.querySelector(':scope > [data-bkpr-pinned-tray="1"]');
    if (!tray) {
      tray = document.createElement("div");
      tray.dataset.bkprPinnedTray = "1";
      tray.style.cssText = [
        "display:flex",
        "flex-direction:column",
        "background:rgba(245,158,11,0.06)",
        "border-bottom:1px solid rgba(0,0,0,0.08)",
        "padding:0",
        "position:relative",
        "z-index:1"
      ].join(";");
      parent.insertBefore(tray, list);
    }
    return tray;
  }

  // Reorder / render pinned chats in the tray, hide originals in the
  // virtual scroller.
  function reorderAllPinned() {
    const pinnedArr = [...pinned];
    const dom = window.BeePlus.dom;
    const chatList = dom && dom.findChatList && dom.findChatList();
    if (!chatList) return;
    const tray = ensurePinnedTray(chatList);
    if (!tray) return;

    // Remove tray-clones for chats no longer pinned.
    [...tray.querySelectorAll('[data-bkpr-pin-clone="1"]')].forEach((clone) => {
      const id = clone.dataset.bkprChatId;
      if (!pinned.has(id)) {
        clone.remove();
        // Also un-hide the original in the list.
        const orig = dom.shadowQuerySelector(`[data-bkpr-chat-id="${id}"]:not([data-bkpr-pin-clone])`);
        if (orig) orig.style.removeProperty("display");
      }
    });

    if (pinnedArr.length === 0) {
      // Nothing left pinned — remove tray if empty.
      if (!tray.children.length) tray.remove();
      return;
    }

    pinnedArr.forEach((id, i) => {
      // Find the original row (NOT a clone) — shadow-piercing.
      const originals = dom.shadowQuerySelectorAll(`[data-bkpr-chat-id="${id}"]`);
      const orig = originals.find((el) => el.dataset.bkprPinClone !== "1");
      if (!orig) return; // preRender will bring it into DOM later

      // Hide original so we don't show duplicates.
      orig.style.setProperty("display", "none", "important");

      // Ensure clone exists in tray.
      let clone = tray.querySelector(`[data-bkpr-pin-clone="1"][data-bkpr-chat-id="${id}"]`);
      if (!clone) {
        clone = orig.cloneNode(true);
        clone.dataset.bkprPinClone = "1";
        // Undo any inline "display:none" copied from the hidden original.
        clone.style.removeProperty("display");
        // Neutralize virtual-scroller absolute positioning that might have
        // been copied — the tray is a normal flex flow, not a virtual list.
        clone.style.setProperty("position", "static", "important");
        clone.style.setProperty("transform", "none", "important");
        clone.style.setProperty("top", "auto", "important");
        clone.style.setProperty("left", "auto", "important");
        clone.style.setProperty("width", "auto", "important");
        // Highlight — same styling applyPinState uses.
        clone.style.setProperty("background-color", "rgba(245,158,11,0.06)", "important");
        clone.style.setProperty("border-left", "3px solid #f59e0b", "important");
        clone.classList.add("bkpr-pinned-row");
        // cloneNode copies dataset.bkprPinned="1" from the original, which
        // makes decorateRow's short-circuit skip. Clear it so we get a
        // fresh pin-btn with a working click handler on the clone.
        delete clone.dataset.bkprPinned;
        const oldBtn = clone.querySelector(".bkpr-pin-btn");
        if (oldBtn) oldBtn.remove();
        // Append FIRST so decorateRow's ensureFlexParent sees the tray as parent.
        tray.appendChild(clone);
        decorateRow(clone, id);
      }
      // Order clones by pin insertion order.
      if (tray.children[i] !== clone) {
        tray.insertBefore(clone, tray.children[i] || null);
      }
    });
  }

  function decorateRow(row, uuid) {
    if (row.dataset.bkprPinned === "1") {
      // already decorated, just sync state
      applyPinState(row, pinned.has(uuid));
      return;
    }
    row.dataset.bkprPinned = "1";
    row.dataset.bkprChatId = uuid;
    ensureFlexParent(row.parentElement);
    applyPinState(row, pinned.has(uuid));

    const btn = document.createElement("button");
    btn.className = "bkpr-pin-btn";
    btn.title = "Pin / Unpin";
    btn.innerHTML = pinned.has(uuid) ? "📌" : "📍";
    // Position top-left (back to v1.2.4 placement) — avoids "..." menu and
    // date column on the right side. BeePlus user feedback preferred this spot.
    btn.style.cssText =
      "position:absolute;top:2px;left:2px;background:transparent;border:none;cursor:pointer;font-size:11px;line-height:1;opacity:0;transition:opacity .15s;z-index:10;padding:1px;";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (pinned.has(uuid)) pinned.delete(uuid);
      else pinned.add(uuid);
      await savePinned();
      btn.innerHTML = pinned.has(uuid) ? "📌" : "📍";
      applyPinState(row, pinned.has(uuid));
      reorderAllPinned();
    });
    row.style.position = row.style.position || "relative";
    row.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
    row.addEventListener("mouseleave", () => (btn.style.opacity = pinned.has(uuid) ? "0.55" : "0"));
    if (pinned.has(uuid)) btn.style.opacity = "0.55";
    row.appendChild(btn);
  }

  // Diagnostic stats from the last scan. Stored on window.BeePlus.stickyPin
  // so the user can inspect them via the diagnose() helper.
  let lastScanStats = null;

  function scanRows() {
    // Scan strictly inside the chat-list container. If Beekeeper's chat-list
    // selector can't be found, scan the whole document — the heuristics
    // below (height + EXCLUDE_ANCESTOR_SEL) keep us out of trouble.
    // Shadow-DOM piercing: Beekeeper's chat-list lives inside
    // <BEEKEEPER-CHATS-VIEW>'s shadow-root — we use shadowQuerySelectorAll.
    const dom = window.BeePlus.dom;
    const chatList = dom && dom.findChatList && dom.findChatList();
    const scope = chatList || document;
    const sidebarRightLimit = Math.max(600, window.innerWidth * 0.7);
    const stats = {
      scopeIsDocument: scope === document,
      linksFound: 0,
      noUuid: 0,
      excludedAncestor: 0,
      noRow: 0,
      tooTall: 0,
      tooFarRight: 0,
      tooSmall: 0,
      decorated: 0,
      sidebarRightLimit: sidebarRightLimit,
      viewport: { w: window.innerWidth, h: window.innerHeight }
    };
    let count = 0;
    // shadowQuerySelectorAll pierces every shadow-root reachable from scope.
    const links = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll(LINK_SEL, scope)
      : [...scope.querySelectorAll(LINK_SEL)];
    links.forEach((link) => {
      stats.linksFound++;
      const uuid = extractUuidFromLink(link);
      if (!uuid) { stats.noUuid++; return; }
      // Inline-detect why findRowFromLink might return null so the diagnose
      // output tells us which filter is the bottleneck.
      if (link.closest(EXCLUDE_ANCESTOR_SEL)) { stats.excludedAncestor++; return; }
      const row = findRowFromLink(link);
      if (!row) { stats.noRow++; return; }
      const rect = row.getBoundingClientRect();
      // Defense 1: chat-list rows are SHORT (compact preview). Message
      // bubbles in the open chat are tall. v1.2.18 raised ceiling from
      // 120 to 200 — current Beekeeper layout has 2-line preview + status
      // row + padding (~140-180px). Message bubbles still differentiate
      // (typically 300+px or full-width).
      if (rect.height > 200) { stats.tooTall++; return; }
      // Defense 2: chat-list rows live in the LEFT sidebar. A row whose
      // right edge sits past the sidebar boundary is a message link.
      if (rect.right > sidebarRightLimit) { stats.tooFarRight++; return; }
      // Defense 3: skip rows with zero size (not yet rendered / hidden).
      if (rect.width < 40 || rect.height < 20) { stats.tooSmall++; return; }
      decorateRow(row, uuid);
      stats.decorated++;
      count++;
    });
    lastScanStats = stats;
    // Bridge stats to MAIN-world so page-console (devtools default context)
    // can read them via window.__bkprStickyStats. Helps diagnose without
    // switching DevTools context. page-script.js listens for this message.
    try {
      window.postMessage({ source: "bkpr-ext", type: "sticky-stats", value: stats }, "*");
    } catch (_) {}
    // Single deterministic reorder pass after all rows are decorated, so
    // multiple pinned rows don't fight for the first slot one-by-one.
    reorderAllPinned();
    return count;
  }

  function refreshAll() {
    const dom = window.BeePlus.dom;
    const decorated = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll('[data-bkpr-pinned="1"]')
      : [...document.querySelectorAll('[data-bkpr-pinned="1"]')];
    decorated.forEach((row) => {
      const uuid = row.dataset.bkprChatId;
      const btn = row.querySelector(".bkpr-pin-btn");
      const isPinned = pinned.has(uuid);
      if (btn) btn.innerHTML = isPinned ? "📌" : "📍";
      applyPinState(row, isPinned);
    });
    reorderAllPinned();
  }

  function onStorageChange(changes, area) {
    if (area !== "sync" || !changes[SETTINGS_KEY]) return;
    pinned = new Set(((changes[SETTINGS_KEY].newValue || {}).pinnedIds) || []);
    refreshAll();
  }

  // Returns true if every pinned chat ID has a corresponding row in the DOM.
  function allPinnedInDom() {
    const dom = window.BeePlus.dom;
    for (const id of pinned) {
      const selector = `[data-bkpr-chat-id="${id}"]`;
      const found = dom && dom.shadowQuerySelector
        ? dom.shadowQuerySelector(selector)
        : document.querySelector(selector);
      if (!found) return false;
    }
    return true;
  }

  // Walk up from a sample row until we find the scrollable ancestor.
  // Crosses shadow-root boundaries — Beekeeper's virtual scroller may live
  // above the <BEEKEEPER-CHATS-VIEW> shadow-host in light-DOM. Without
  // shadow-crossing, .parentElement returns null at the boundary and the
  // walk stops, so the virtual-scroller sweep never runs and pinned chats
  // beyond the initial render window never get decorated.
  function findScrollContainer(fromEl) {
    const dom = window.BeePlus.dom;
    const chain = (dom && dom.ancestorsCrossingShadow)
      ? dom.ancestorsCrossingShadow(fromEl, 30)
      : (() => {
          const out = []; let cur = fromEl;
          while (cur) { out.push(cur); cur = cur.parentElement; }
          return out;
        })();
    for (const cur of chain) {
      if (!cur || cur === document.body || cur === document.documentElement) continue;
      if (!cur.getBoundingClientRect || !window.getComputedStyle) continue;
      let cs;
      try { cs = window.getComputedStyle(cur); } catch (_) { continue; }
      if (!cs) continue;
      if (
        (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
        cur.scrollHeight > cur.clientHeight + 10
      ) {
        return cur;
      }
    }
    return null;
  }

  // Beekeeper's chat list uses a virtual scroller — only visible items are
  // in the DOM. If a pinned chat is at position 50 in the data model but
  // only the first 20 are rendered, our scanner can't see it. Trigger
  // Beekeeper's virtual scroller to render every pinned chat by stepping
  // through the scroll container, then snap back to the top so the user
  // never sees it move.
  let preRenderInProgress = false;
  let lastPreRenderAttempt = 0;
  async function preRenderPinnedRows(reason) {
    if (preRenderInProgress) {
      dbg("preRender skipped: already in progress", { reason });
      return;
    }
    if (pinned.size === 0) return;
    if (allPinnedInDom()) {
      reorderAllPinned();
      return;
    }

    // Find a sample row first — without it we can't locate the scroller.
    // Importantly: do NOT consume the throttle here. Otherwise an early
    // call (e.g. init-800ms when the sidebar isn't mounted yet) would block
    // every later call for 3 seconds without ever doing real work.
    const dom = window.BeePlus.dom;
    const sample =
      (dom && dom.shadowQuerySelector && dom.shadowQuerySelector('[data-bkpr-chat-id]')) ||
      (dom && dom.shadowQuerySelector && dom.shadowQuerySelector('[data-bkpr-pinned="1"]')) ||
      document.querySelector('[data-bkpr-chat-id]') ||
      document.querySelector('[data-bkpr-pinned="1"]');
    if (!sample) {
      dbg("preRender skipped: no sample row in DOM yet", { reason });
      return;
    }
    const scroller = findScrollContainer(sample.parentElement);
    if (!scroller) {
      dbg("preRender skipped: no scroll container found", {
        reason,
        sampleParentChain: chainOfElements(sample.parentElement, 6)
      });
      return;
    }

    // Now we have everything — apply throttle so the MutationObserver
    // doesn't kick off a sweep on every single tick.
    const now = Date.now();
    if (now - lastPreRenderAttempt < 3000) {
      dbg("preRender skipped: throttled", {
        reason,
        sinceLastMs: now - lastPreRenderAttempt
      });
      return;
    }
    lastPreRenderAttempt = now;

    if (DEBUG) {
      const decoratedEls = dom && dom.shadowQuerySelectorAll
        ? dom.shadowQuerySelectorAll('[data-bkpr-pinned="1"]')
        : [...document.querySelectorAll('[data-bkpr-pinned="1"]')];
      const decoratedIds = decoratedEls.map((r) => r.dataset.bkprChatId);
      const missingIds = [...pinned].filter((id) => !decoratedIds.includes(id));
      dbg("preRender START", {
        reason,
        pinnedCount: pinned.size,
        decoratedCount: decoratedIds.length,
        missingCount: missingIds.length,
        missingIds: missingIds,
        scroller: { tag: scroller.tagName, cls: scroller.className, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight }
      });
    }

    preRenderInProgress = true;
    const startTop = scroller.scrollTop;
    try {
      const maxTop = scroller.scrollHeight - scroller.clientHeight;
      const step = Math.max(scroller.clientHeight * 0.8, 300);
      const maxSteps = 30;
      let pos = scroller.scrollTop;
      let steps = 0;
      for (let i = 0; i < maxSteps && pos < maxTop; i++) {
        pos = Math.min(pos + step, maxTop);
        scroller.scrollTop = pos;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        // Bail if the feature was disabled mid-flight — otherwise scanRows
        // would keep re-decorating rows that teardown() just cleaned up.
        if (disposed) return;
        scanRows();
        steps++;
        if (allPinnedInDom()) break;
      }
      dbg("preRender END", {
        steps,
        allInDom: allPinnedInDom(),
        decoratedCount: dom && dom.shadowQuerySelectorAll
          ? dom.shadowQuerySelectorAll('[data-bkpr-pinned="1"]').length
          : document.querySelectorAll('[data-bkpr-pinned="1"]').length
      });
    } finally {
      scroller.scrollTop = startTop;
      reorderAllPinned();
      preRenderInProgress = false;
    }
  }

  // Helper for diagnostic output: list ancestor chain (tag.className).
  // Uses shadow-crossing ancestry so debug logs show the true chain across
  // <BEEKEEPER-CHATS-VIEW>'s shadow-root boundary.
  function chainOfElements(el, depth) {
    const dom = window.BeePlus.dom;
    const chain = (dom && dom.ancestorsCrossingShadow)
      ? dom.ancestorsCrossingShadow(el, depth)
      : (() => {
          const out = []; let cur = el;
          for (let i = 0; cur && i < depth; i++) { out.push(cur); cur = cur.parentElement; }
          return out;
        })();
    return chain.slice(0, depth).map((e) => e ? `${e.tagName}.${e.className}` : "");
  }

  function injectCss() {
    // This <style> lives at document.head — it does NOT pierce shadow-DOM.
    // For rows inside <BEEKEEPER-CHATS-VIEW>'s shadow-root, the highlight
    // (background/border) is set inline by applyPinState() and the
    // ordering is enforced by reorderAllPinned()'s insertBefore-DOM-move
    // (not by `order: -1` + flex, which is a light-DOM-only optimization).
    // The rules below only apply to legacy light-DOM chat lists, if any.
    if (document.getElementById("bkpr-pinned-style")) return;
    const s = document.createElement("style");
    s.id = "bkpr-pinned-style";
    s.textContent = `
      /* Legacy light-DOM only. Shadow-DOM rows use inline styles instead
         (see applyPinState() and reorderAllPinned() DOM-move). */
      .bkpr-pin-flex-parent:has(.bkpr-pinned-row) {
        display: flex !important;
        flex-direction: column !important;
      }
      .bkpr-pinned-row {
        background-color: rgba(245, 158, 11, 0.06) !important;
        border-left: 3px solid #f59e0b !important;
      }
    `;
    document.head.appendChild(s);
  }

  async function init() {
    disposed = false;
    await loadPinned();
    chrome.storage.onChanged.addListener(onStorageChange);
    injectCss();

    const initial = scanRows();
    dbg(`init: decorated ${initial} chat rows`, lastScanStats);

    // Debounced re-scan with MAX-wait. Beekeeper can produce continuous
    // micro-mutations (animations, timestamps, hover states) that keep
    // resetting a pure-debounce timer indefinitely. We therefore force a
    // scan if the timer has been resetting for more than 1.5s.
    let lastReportedCount = initial;
    let lastDebounceStart = 0;
    teardownObserver = window.BeePlus.dom.observe(document.body, { childList: true, subtree: true }, () => {
      if (disposed) return;
      const now = Date.now();
      if (lastDebounceStart === 0) lastDebounceStart = now;
      clearTimeout(scanTimer);
      const elapsed = now - lastDebounceStart;
      const delay = elapsed > 1500 ? 0 : 300;
      scanTimer = setTimeout(() => {
        if (disposed) return;
        lastDebounceStart = 0;
        const c = scanRows();
        if (c !== lastReportedCount) {
          dbg(`re-scan: decorated ${c} chat rows`, lastScanStats);
          lastReportedCount = c;
        }
        if (pinned.size > 0 && !allPinnedInDom()) preRenderPinnedRows("mutation-observer");
      }, delay);
    });

    // Safety-net interval: scan every 2s for the first 60s. If MutationObserver
    // never fires (e.g. Beekeeper renders chat list via shadow DOM or the
    // observer's debounce keeps resetting), this guarantees we eventually pick
    // up the chat rows.
    let safetyNetCount = 0;
    safetyNetTimer = setInterval(() => {
      if (disposed) return;
      safetyNetCount++;
      const c = scanRows();
      if (c !== lastReportedCount) {
        dbg(`safety-net scan #${safetyNetCount}: decorated ${c} chat rows`, lastScanStats);
        lastReportedCount = c;
      }
      if (safetyNetCount >= 30) { clearInterval(safetyNetTimer); safetyNetTimer = null; }
    }, 2000);

    // Initial pre-render attempt — wait briefly for Beekeeper to mount its
    // sidebar before we look for scroll containers.
    setTimeout(() => {
      if (disposed) return;
      preRenderPinnedRows("init-800ms");
    }, 800);
  }

  function teardown() {
    disposed = true;
    chrome.storage.onChanged.removeListener(onStorageChange);
    if (teardownObserver) { teardownObserver(); teardownObserver = null; }
    if (safetyNetTimer) { clearInterval(safetyNetTimer); safetyNetTimer = null; }
    clearTimeout(scanTimer);
    scanTimer = null;
    const dom = window.BeePlus.dom;
    const decorated = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll('[data-bkpr-pinned="1"]')
      : [...document.querySelectorAll('[data-bkpr-pinned="1"]')];
    decorated.forEach((row) => {
      delete row.dataset.bkprPinned;
      delete row.dataset.bkprChatId;
      row.style.removeProperty("order");
      row.classList.remove("bkpr-pinned-row");
      row.style.removeProperty("background-color");
      row.style.removeProperty("border-left");
      const btn = row.querySelector(".bkpr-pin-btn");
      if (btn) btn.remove();
    });
    const flexParents = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll(".bkpr-pin-flex-parent, [data-bkpr-shadow-flex-host='1']")
      : [...document.querySelectorAll(".bkpr-pin-flex-parent, [data-bkpr-shadow-flex-host='1']")];
    flexParents.forEach((p) => {
      p.classList.remove("bkpr-pin-flex-parent");
      // Undo shadow-DOM inline flex too.
      if (p.dataset && p.dataset.bkprShadowFlexHost === "1") {
        delete p.dataset.bkprShadowFlexHost;
        p.style.removeProperty("display");
        p.style.removeProperty("flex-direction");
      }
    });
    // Clean up any pinned-wrapper markers with their inline order.
    const wrappers = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll('[data-bkpr-pin-wrapper="1"]')
      : [...document.querySelectorAll('[data-bkpr-pin-wrapper="1"]')];
    wrappers.forEach((w) => {
      delete w.dataset.bkprPinWrapper;
      w.style.removeProperty("order");
    });
    // Un-hide any originals we hid because their clone was in the tray.
    const hidden = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll('[data-bkpr-chat-id]')
      : [...document.querySelectorAll('[data-bkpr-chat-id]')];
    hidden.forEach((el) => {
      if (el.dataset.bkprPinClone !== "1") el.style.removeProperty("display");
    });
    // Remove tray-clones + tray itself.
    const trays = dom && dom.shadowQuerySelectorAll
      ? dom.shadowQuerySelectorAll('[data-bkpr-pinned-tray="1"]')
      : [...document.querySelectorAll('[data-bkpr-pinned-tray="1"]')];
    trays.forEach((tray) => tray.remove());
    const s = document.getElementById("bkpr-pinned-style");
    if (s) s.remove();
  }

  window.BeePlus.stickyPin = {
    async getPinned() { await loadPinned(); return [...pinned]; },
    async unpin(id) {
      await loadPinned();
      pinned.delete(id);
      await savePinned();
    },
    // Debug helper: run window.BeePlus.stickyPin.diagnose() in the console
    // to see what scanRows() saw last and what filters rejected which links.
    // Tip: enable verbose logging with
    //   localStorage.setItem("bkpr.debug.stickyPin", "1")
    // and reload — every step (init, re-scan, preRender) will then log.
    diagnose() {
      const dom = window.BeePlus.dom;
      const allLinks = dom && dom.shadowQuerySelectorAll
        ? dom.shadowQuerySelectorAll(LINK_SEL)
        : [...document.querySelectorAll(LINK_SEL)];
      const decoratedRows = dom && dom.shadowQuerySelectorAll
        ? dom.shadowQuerySelectorAll('[data-bkpr-pinned="1"]')
        : [...document.querySelectorAll('[data-bkpr-pinned="1"]')];
      console.group("[BeePlus sticky-pin] diagnose");
      console.log("Verbose logging enabled:", DEBUG, "(toggle: localStorage.bkpr.debug.stickyPin)");
      console.log("Pinned IDs in storage:", [...pinned]);
      console.log("Decorated rows in DOM:", decoratedRows.length);
      console.log("LINK_SEL:", LINK_SEL);
      console.log("All chat links (shadow-piercing):", allLinks.length);
      console.log("Last scan stats:", lastScanStats);
      console.log("findChatList() returned:",
        dom && dom.findChatList && dom.findChatList());
      console.log("Sample of first 5 chat links:");
      [...allLinks].slice(0, 5).forEach((link, i) => {
        const uuid = extractUuidFromLink(link);
        const excluded = !!link.closest(EXCLUDE_ANCESTOR_SEL);
        const row = excluded ? null : findRowFromLink(link);
        const rect = row ? row.getBoundingClientRect() : null;
        console.log(`  [${i}]`, {
          href: link.href,
          uuid: uuid,
          excludedByAncestor: excluded,
          row: row ? `${row.tagName}.${row.className}` : null,
          rect: rect ? { top: rect.top, right: rect.right, w: rect.width, h: rect.height } : null
        });
      });
      console.groupEnd();
      return lastScanStats;
    }
  };

  window.BeePlus.FeatureRegistry.register({
    id: "sticky-pin",
    name: "featureStickyPin",
    description: "featureStickyPinDesc",
    defaultEnabled: true,
    settingsKey: SETTINGS_KEY,
    init,
    teardown
  });
})();
