// Feature: Reminder Bot — right-click on a message → snooze → desktop notification.
// Uses chrome.alarms (survives tab close) for scheduling, chrome.notifications for delivery.

(function () {
  const SETTINGS_KEY = "feature.reminderBot";
  const STORE_KEY = "reminders.list";

  let activeMessage = null;
  let dismissHandler = null; // click-to-close listener; kept in a ref so
                             // closeMenu()/teardown() can remove it.
  let dismissRegisterTimer = null; // setTimeout(0) handle. Must be cancelled
                                   // on rapid re-open / teardown or the
                                   // deferred addEventListener attaches a
                                   // ghost listener that never gets removed.
  let detachContextMenu = null; // shadow-crossing listener detach

  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  // Tighter message selectors. The old broad "*message*" substring match
  // caught unrelated things like "message-composer", "thread-header",
  // "unread-messages-badge" — right-clicking there triggered the snooze
  // menu on a non-message. Also removed "[data-bkpr-id=\"inbox-list-item\"]"
  // (an inbox-list-item is a whole conversation, not a message body —
  // snoozing a whole thread is out of scope for this feature).
  const MSG_SEL = [
    '[data-bkpr-id="message"]',
    '[data-bkpr-id="chat-message"]',
    '[data-bkpr-id^="message-bubble"]',
    '[data-bkpr-id^="chat-message-"]',
    ".message-item",
    ".bkpr-message"
  ].join(",");

  function isMessage(el) {
    if (!el || el.nodeType !== 1 || !el.matches) return false;
    try { return el.matches(MSG_SEL); } catch (_) { return false; }
  }

  function init() {
    // Same reason as profile-hover: Beekeeper's <beekeeper-chats-view>
    // stops event propagation inside its shadow-root, so a plain
    // document-level contextmenu listener misses every right-click on a
    // chat message. Attach across all shadow-roots too.
    const dom = window.BeePlus.dom;
    if (dom && dom.addListenerAcrossShadows) {
      detachContextMenu = dom.addListenerAcrossShadows("contextmenu", onContextMenu, { capture: true });
    } else {
      document.addEventListener("contextmenu", onContextMenu, true);
    }
  }

  function teardown() {
    if (detachContextMenu) { detachContextMenu(); detachContextMenu = null; }
    document.removeEventListener("contextmenu", onContextMenu, true);
    closeMenu();
    activeMessage = null;
  }

  function onContextMenu(e) {
    // event.target is retargeted to the shadow-host when the true target
    // lives inside a shadow-root (Beekeeper's <BEEKEEPER-CHATS-VIEW>).
    // dom.findInPath walks the composedPath which crosses shadow-boundaries.
    const dom = window.BeePlus.dom;
    let msgEl = dom && dom.findInPath ? dom.findInPath(e, isMessage) : null;
    if (!msgEl) {
      // Seed the walk from composedPath[0] (the real inner target) rather
      // than e.target (the shadow-host) — walking up from the host never
      // descends into the shadow-DOM so the plain e.target fallback was
      // dead-code for the new UI.
      const seed = (e.composedPath && e.composedPath()[0]) || e.target;
      msgEl = findMessageElement(seed);
    }
    if (!msgEl) return;
    e.preventDefault();
    activeMessage = extractMessageInfo(msgEl);
    openMenu(e.clientX, e.clientY);
  }

  function findMessageElement(el) {
    let cur = el;
    let hops = 0;
    while (cur && cur !== document && cur !== document.body && hops < 30) {
      if (isMessage(cur)) return cur;
      // Cross shadow-boundaries when walking up.
      let next = cur.parentElement;
      if (!next) {
        const rootNode = cur.getRootNode && cur.getRootNode();
        if (rootNode && rootNode.host) next = rootNode.host;
      }
      cur = next;
      hops++;
    }
    return null;
  }

  function extractMessageInfo(el) {
    const text = (el.innerText || "").slice(0, 200).replace(/\s+/g, " ").trim();
    let url = location.href;
    // Prefer explicit data attributes; regex-scraping outerHTML misses
    // content inside shadow-roots (outerHTML does not include shadow DOM),
    // so for Web-Component messages we would silently produce msgId:null.
    let msgId = null;
    if (el.dataset && el.dataset.messageId) msgId = el.dataset.messageId;
    if (!msgId && el.dataset && el.dataset.bkprId && /message/i.test(el.dataset.bkprId)) {
      // bkpr-id sometimes encodes the UUID directly, e.g. "chat-message-<UUID>".
      const m = el.dataset.bkprId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (m) msgId = m[0];
    }
    if (!msgId) {
      // Scan outerHTML AND inner shadowRoot HTML (if any) for a UUID.
      let hay = el.outerHTML || "";
      try { if (el.shadowRoot) hay += el.shadowRoot.innerHTML; } catch (_) {}
      const idMatch = hay.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (idMatch) msgId = idMatch[0];
    }
    return { text, url, ts: Date.now(), msgId };
  }

  function openMenu(x, y) {
    closeMenu();
    const menu = document.createElement("div");
    menu.id = "bkpr-reminder-menu";
    menu.style.cssText = `position:fixed;top:${y}px;left:${x}px;z-index:2147483647;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.15);padding:6px 0;min-width:200px;font-family:-apple-system,sans-serif;font-size:13px;`;
    const items = [
      ["reminderIn5m", "In 5 minutes", 5 * 60 * 1000],
      ["reminderIn30m", "In 30 minutes", 30 * 60 * 1000],
      ["reminderIn1h", "In 1 hour", 60 * 60 * 1000],
      ["reminderIn3h", "In 3 hours", 3 * 60 * 60 * 1000],
      ["reminderTomorrow", "Tomorrow morning", "tomorrow"],
      ["reminderCustom", "Custom...", "custom"]
    ];
    for (const [key, fb, val] of items) {
      const it = document.createElement("div");
      it.textContent = i18n(key, fb);
      it.style.cssText = "padding:8px 16px;cursor:pointer;color:#111827;";
      it.onmouseenter = () => (it.style.background = "#f3f4f6");
      it.onmouseleave = () => (it.style.background = "transparent");
      it.onclick = () => {
        closeMenu();
        scheduleReminder(val);
      };
      menu.appendChild(it);
    }
    document.body.appendChild(menu);
    // Register click-to-dismiss with capture:true — Beekeeper's Web
    // Components sometimes call stopPropagation on bubble-phase clicks
    // inside the chat view; without capture we would never see the click
    // and the menu would linger. Also keep the handler reference so we
    // can detach it explicitly in closeMenu() / teardown() rather than
    // relying on once:true, which leaks if the user never clicks anywhere.
    // The timer id must be tracked too — rapid re-open otherwise leaks a
    // ghost handler (S1 fires post-closeMenu(S1), so its handler is never
    // referenced by dismissHandler at removal time).
    dismissRegisterTimer = setTimeout(() => {
      dismissRegisterTimer = null;
      dismissHandler = () => closeMenu();
      document.addEventListener("click", dismissHandler, { capture: true });
    }, 0);
  }

  function closeMenu() {
    const m = document.getElementById("bkpr-reminder-menu");
    if (m) m.remove();
    if (dismissRegisterTimer !== null) {
      clearTimeout(dismissRegisterTimer);
      dismissRegisterTimer = null;
    }
    if (dismissHandler) {
      try { document.removeEventListener("click", dismissHandler, { capture: true }); } catch (_) {}
      dismissHandler = null;
    }
  }

  async function scheduleReminder(when) {
    if (!activeMessage) return;
    let ts = Date.now();
    if (when === "tomorrow") {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(8, 0, 0, 0);
      ts = t.getTime();
    } else if (when === "custom") {
      const input = prompt("Erinnerung in wie vielen Minuten?", "60");
      const mins = parseInt(input, 10);
      if (!mins || mins <= 0) return;
      ts = Date.now() + mins * 60 * 1000;
    } else {
      ts = Date.now() + Number(when);
    }

    const reminder = {
      id: "rem_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      message: activeMessage,
      due: ts
    };
    const got = await chrome.storage.local.get({ [STORE_KEY]: [] });
    const list = got[STORE_KEY] || [];
    list.push(reminder);
    await chrome.storage.local.set({ [STORE_KEY]: list });
    await chrome.runtime.sendMessage({ target: "bkpr-reminder", action: "schedule", reminder });
    showToast(`✅ Erinnerung gesetzt für ${new Date(ts).toLocaleTimeString()}`);
  }

  function showToast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#1f2937;color:#fff;padding:10px 16px;border-radius:8px;z-index:2147483647;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.2);";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  window.BeePlus.FeatureRegistry.register({
    id: "reminder-bot",
    name: "featureReminderBot",
    description: "featureReminderBotDesc",
    defaultEnabled: true,
    settingsKey: SETTINGS_KEY,
    init,
    teardown
  });
})();
