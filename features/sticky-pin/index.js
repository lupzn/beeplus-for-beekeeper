// Feature: Sticky Pin — keep selected chats at the top of the chat list.
// Strategy: never touch the DOM order (Vue/Backbone gets confused). Instead
// force the parent to `display: flex; flex-direction: column` and use
// `order: -1` on pinned rows. CSS-only = no re-render conflicts.

(function () {
  const SETTINGS_KEY = "feature.stickyPin";
  const DEFAULTS = { pinnedIds: [] };
  const LINK_SEL = 'a[href*="/streams/"], a[href*="/chats/"], a[href*="/conversations/"], a[href*="/inbox/"]';
  const UUID_REGEX = window.BeePlus.api.UUID_REGEX;

  let teardownObserver = null;
  let pinned = new Set();
  let scanTimer = null;

  async function loadPinned() {
    const got = await chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULTS });
    pinned = new Set((got[SETTINGS_KEY] && got[SETTINGS_KEY].pinnedIds) || []);
  }

  async function savePinned() {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { pinnedIds: [...pinned] } });
  }

  function findRowFromLink(linkEl) {
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
    parent.classList.add("bkpr-pin-flex-parent");
  }

  function applyPinState(row, isPinned) {
    if (isPinned) {
      row.classList.add("bkpr-pinned-row");
      row.style.setProperty("order", "-1", "important");
    } else {
      row.classList.remove("bkpr-pinned-row");
      row.style.removeProperty("order");
    }
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
    btn.style.cssText =
      "position:absolute;top:4px;right:4px;background:transparent;border:none;cursor:pointer;font-size:14px;opacity:0;transition:opacity .15s;z-index:10;padding:2px;";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (pinned.has(uuid)) pinned.delete(uuid);
      else pinned.add(uuid);
      await savePinned();
      btn.innerHTML = pinned.has(uuid) ? "📌" : "📍";
      applyPinState(row, pinned.has(uuid));
    });
    row.style.position = row.style.position || "relative";
    row.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
    row.addEventListener("mouseleave", () => (btn.style.opacity = pinned.has(uuid) ? "0.7" : "0"));
    if (pinned.has(uuid)) btn.style.opacity = "0.7";
    row.appendChild(btn);
  }

  function scanRows() {
    let count = 0;
    document.querySelectorAll(LINK_SEL).forEach((link) => {
      const uuid = extractUuidFromLink(link);
      if (!uuid) return;
      const row = findRowFromLink(link);
      if (row) {
        decorateRow(row, uuid);
        count++;
      }
    });
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
  }

  function onStorageChange(changes, area) {
    if (area !== "sync" || !changes[SETTINGS_KEY]) return;
    pinned = new Set(((changes[SETTINGS_KEY].newValue || {}).pinnedIds) || []);
    refreshAll();
  }

  function injectCss() {
    if (document.getElementById("bkpr-pinned-style")) return;
    const s = document.createElement("style");
    s.id = "bkpr-pinned-style";
    s.textContent = `
      .bkpr-pin-flex-parent { display: flex !important; flex-direction: column !important; }
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
    console.log(`[BeePlus sticky-pin] decorated ${initial} chat rows`);

    // Debounced re-scan: wait 300ms after last DOM change.
    teardownObserver = window.BeePlus.dom.observe(document.body, { childList: true, subtree: true }, () => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scanRows, 300);
    });
  }

  function teardown() {
    chrome.storage.onChanged.removeListener(onStorageChange);
    if (teardownObserver) teardownObserver();
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
