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
  const LINK_SEL = 'a[href*="/streams/"], a[href*="/chats/"], a[href*="/conversations/"], a[href*="/inbox/"]';
  const UUID_REGEX = window.BeePlus.api.UUID_REGEX;

  let teardownObserver = null;
  let pinned = new Set();
  let scanTimer = null;

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
    // This is the primary safety net — once we are past it we are inside the
    // chat list, so the broader heuristic below is safe.
    if (linkEl.closest(EXCLUDE_ANCESTOR_SEL)) return null;

    let cur = linkEl;
    for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
      if (cur.tagName === "LI") return cur;
      const cls = (cur.className || "").toString();
      if (/item|row|list-entry|chat|stream|conversation/i.test(cls) && cur !== linkEl) return cur;
      cur = cur.parentElement;
    }
    return linkEl.closest("li") || linkEl.parentElement || linkEl;
  }

  function extractUuidFromLink(linkEl) {
    const m = (linkEl.href || "").match(UUID_REGEX);
    return m ? m[0] : null;
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
    // Only mark the parent — CSS `:has()` rule (in injectCss) applies flex
    // ONLY when the parent contains an actually-pinned row. Empty or unpinned
    // parents stay in their native layout, so chat-bottom auto-scroll works.
    parent.classList.add("bkpr-pin-flex-parent");
  }

  function applyPinState(row, isPinned) {
    if (isPinned) {
      row.classList.add("bkpr-pinned-row");
      row.style.setProperty("order", "-1", "important");
    } else {
      row.classList.remove("bkpr-pinned-row");
      row.style.removeProperty("order");
      // Don't try to restore original position — Beekeeper will resort
      // its list on the next data update / interaction.
    }
  }

  // Reorder all pinned rows to the top of their parent in pin-insertion
  // order. Single deterministic pass — avoids the "ping-pong" problem of
  // calling moveRowToTop per row, where two pinned rows would fight for
  // the first slot every time the MutationObserver re-scanned.
  // Idempotent: returns early if rows are already in the correct positions.
  function reorderAllPinned() {
    const pinnedArr = [...pinned]; // Set iteration is insertion-ordered
    if (pinnedArr.length === 0) return;

    // Collect all currently-decorated rows that should still be pinned,
    // grouped by their parent (defensive — there could be more than one
    // chat list mounted, e.g. mobile + desktop sidebar).
    const byParent = new Map();
    document.querySelectorAll('[data-bkpr-pinned="1"]').forEach((row) => {
      const id = row.dataset.bkprChatId;
      const idx = pinnedArr.indexOf(id);
      if (idx === -1) return;
      const parent = row.parentElement;
      if (!parent) return;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push({ row, idx });
    });

    byParent.forEach((items, parent) => {
      // Sort by pin-insertion order so first-pinned ends up topmost.
      items.sort((a, b) => a.idx - b.idx);

      // Idempotency check: are these rows already at positions 0..N-1
      // of the parent in the correct order? If yes, do nothing.
      let alreadyOrdered = true;
      for (let i = 0; i < items.length; i++) {
        if (parent.children[i] !== items[i].row) {
          alreadyOrdered = false;
          break;
        }
      }
      if (alreadyOrdered) return;

      // Insert in REVERSE so the last-pinned ends up second, second-to-last
      // ends up third, … and the first-pinned ends up first.
      try {
        for (let i = items.length - 1; i >= 0; i--) {
          parent.insertBefore(items[i].row, parent.firstElementChild);
        }
      } catch (e) {
        // Vue/React mid-render mutation guard.
        console.warn("[BeePlus sticky-pin] reorder failed:", e);
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
    // selector can't be found, we still scan document — the heuristics below
    // (height + EXCLUDE_ANCESTOR_SEL) keep us out of trouble.
    const scope = (window.BeePlus.dom && window.BeePlus.dom.findChatList && window.BeePlus.dom.findChatList()) || document;
    // The chat list lives in the left sidebar. Loosen the right-edge cap
    // (was 45% of viewport — too brittle for wider sidebars / split-screen).
    // Cap at 70% of viewport instead, with a hard floor of 600px.
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
    scope.querySelectorAll(LINK_SEL).forEach((link) => {
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
      // bubbles in the open chat are tall.
      if (rect.height > 120) { stats.tooTall++; return; }
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
    document.querySelectorAll('[data-bkpr-pinned="1"]').forEach((row) => {
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
    for (const id of pinned) {
      if (!document.querySelector(`[data-bkpr-chat-id="${id}"]`)) return false;
    }
    return true;
  }

  // Walk up from a sample row until we find the scrollable ancestor.
  function findScrollContainer(fromEl) {
    let cur = fromEl;
    while (cur && cur !== document.body) {
      const cs = window.getComputedStyle(cur);
      if (
        (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
        cur.scrollHeight > cur.clientHeight + 10
      ) {
        return cur;
      }
      cur = cur.parentElement;
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
    const sample =
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
      const decoratedIds = [...document.querySelectorAll('[data-bkpr-pinned="1"]')].map((r) => r.dataset.bkprChatId);
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
        scanRows();
        steps++;
        if (allPinnedInDom()) break;
      }
      dbg("preRender END", {
        steps,
        allInDom: allPinnedInDom(),
        decoratedCount: document.querySelectorAll('[data-bkpr-pinned="1"]').length
      });
    } finally {
      scroller.scrollTop = startTop;
      reorderAllPinned();
      preRenderInProgress = false;
    }
  }

  // Helper for diagnostic output: list ancestor chain (tag.className).
  function chainOfElements(el, depth) {
    const out = [];
    let cur = el;
    for (let i = 0; cur && i < depth; i++) {
      out.push(`${cur.tagName}.${cur.className}`);
      cur = cur.parentElement;
    }
    return out;
  }

  function injectCss() {
    if (document.getElementById("bkpr-pinned-style")) return;
    const s = document.createElement("style");
    s.id = "bkpr-pinned-style";
    s.textContent = `
      /* Only apply flex layout when the parent actually contains a pinned row.
         Without pinned children, parents keep their native layout — fixes
         broken scroll-to-bottom on chat panels that share the same class.
         Use descendant (no `>`) so wrappers between parent and row are OK. */
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
      const now = Date.now();
      if (lastDebounceStart === 0) lastDebounceStart = now;
      clearTimeout(scanTimer);
      const elapsed = now - lastDebounceStart;
      const delay = elapsed > 1500 ? 0 : 300;
      scanTimer = setTimeout(() => {
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
    const safetyNetInterval = setInterval(() => {
      safetyNetCount++;
      const c = scanRows();
      if (c !== lastReportedCount) {
        dbg(`safety-net scan #${safetyNetCount}: decorated ${c} chat rows`, lastScanStats);
        lastReportedCount = c;
      }
      if (safetyNetCount >= 30) clearInterval(safetyNetInterval);
    }, 2000);
    safetyNetTimer = safetyNetInterval;

    // Initial pre-render attempt — wait briefly for Beekeeper to mount its
    // sidebar before we look for scroll containers.
    setTimeout(() => preRenderPinnedRows("init-800ms"), 800);
  }

  let safetyNetTimer = null;

  function teardown() {
    chrome.storage.onChanged.removeListener(onStorageChange);
    if (teardownObserver) teardownObserver();
    if (safetyNetTimer) clearInterval(safetyNetTimer);
    clearTimeout(scanTimer);
    document.querySelectorAll('[data-bkpr-pinned="1"]').forEach((row) => {
      delete row.dataset.bkprPinned;
      delete row.dataset.bkprChatId;
      row.style.removeProperty("order");
      row.classList.remove("bkpr-pinned-row");
      const btn = row.querySelector(".bkpr-pin-btn");
      if (btn) btn.remove();
    });
    document.querySelectorAll(".bkpr-pin-flex-parent").forEach((p) => p.classList.remove("bkpr-pin-flex-parent"));
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
      const allLinks = document.querySelectorAll(LINK_SEL);
      const decoratedRows = document.querySelectorAll('[data-bkpr-pinned="1"]');
      console.group("[BeePlus sticky-pin] diagnose");
      console.log("Verbose logging enabled:", DEBUG, "(toggle: localStorage.bkpr.debug.stickyPin)");
      console.log("Pinned IDs in storage:", [...pinned]);
      console.log("Decorated rows in DOM:", decoratedRows.length);
      console.log("LINK_SEL:", LINK_SEL);
      console.log("All chat links in document:", allLinks.length);
      console.log("Last scan stats:", lastScanStats);
      console.log("findChatList() returned:",
        window.BeePlus.dom && window.BeePlus.dom.findChatList && window.BeePlus.dom.findChatList());
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
