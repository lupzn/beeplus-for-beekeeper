// Feature: Reminder Bot — right-click on a message → snooze → desktop notification.
// Uses chrome.alarms (survives tab close) for scheduling, chrome.notifications for delivery.

(function () {
  const SETTINGS_KEY = "feature.reminderBot";
  const STORE_KEY = "reminders.list";

  let menuObserver = null;
  let activeMessage = null;

  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  function init() {
    document.addEventListener("contextmenu", onContextMenu, true);
  }

  function teardown() {
    document.removeEventListener("contextmenu", onContextMenu, true);
    closeMenu();
  }

  function onContextMenu(e) {
    const msgEl = findMessageElement(e.target);
    if (!msgEl) return;
    e.preventDefault();
    activeMessage = extractMessageInfo(msgEl);
    openMenu(e.clientX, e.clientY);
  }

  function findMessageElement(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      if (cur.matches && cur.matches('[data-bkpr-id*="message"], .message-item, .bkpr-message')) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function extractMessageInfo(el) {
    const text = (el.innerText || "").slice(0, 200).replace(/\s+/g, " ").trim();
    let url = location.href;
    // Try to find a permalink / data-id
    const idMatch = el.outerHTML.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    return { text, url, ts: Date.now(), msgId: idMatch ? idMatch[0] : null };
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
    setTimeout(() => document.addEventListener("click", closeMenu, { once: true }), 0);
  }

  function closeMenu() {
    const m = document.getElementById("bkpr-reminder-menu");
    if (m) m.remove();
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
