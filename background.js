// BeePlus background service worker.
// - On install: seed default per-feature toggles + per-feature settings.
// - Toolbar click: open options page.
// - Reminder-bot: handle alarm scheduling + delivery via chrome.notifications.

const REMINDER_STORE = "reminders.list";

// Re-inject content scripts into all open Beekeeper tabs on install/update/reload.
// Without this, after `chrome://extensions/ → Reload`, existing tabs have no
// content scripts and chrome.tabs.sendMessage returns "Receiving end does not exist".
async function reinjectContentScriptsInOpenBeekeeperTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://*.beekeeper.io/*" });
    for (const tab of tabs) {
      try {
        // Inject MAIN-world page-script first
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          files: ["page-script.js"]
        });
        // Then ISOLATED-world content scripts in declared order
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            "core/registry.js",
            "core/bkpr-api.js",
            "core/dom-helpers.js",
            "core/stats-tracker.js",
            "core/diagnose.js",
            "features/profile-hover/index.js",
            "features/sticky-pin/index.js",
            "features/theme-engine/index.js",
            "features/quick-polls/index.js",
            "features/export/index.js",
            "features/reminder-bot/index.js",
            "features/personal-stats/index.js",
            "content.js"
          ]
        });
        // Inject CSS too
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["styles.css"]
        });
        console.log(`[BeePlus background] re-injected scripts into tab ${tab.id}`);
      } catch (err) {
        console.warn(`[BeePlus background] inject failed for tab ${tab.id}:`, err.message);
      }
    }
  } catch (err) {
    console.warn("[BeePlus background] reinject error:", err.message);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await reinjectContentScriptsInOpenBeekeeperTabs();

  // One-shot migrations for existing users (when reason === "update")
  if (details.reason === "update") {
    const got = await chrome.storage.sync.get(["bkpr.migration.v1_2_quickpolls"]);
    if (!got["bkpr.migration.v1_2_quickpolls"]) {
      await chrome.storage.sync.set({
        "feature.quick-polls.enabled": true,
        "bkpr.migration.v1_2_quickpolls": true
      });
      console.log("[BeePlus] migration: enabled quick-polls for existing user");
    }
  }
  const defaults = {
    "feature.profile-hover.enabled": true,
    "feature.sticky-pin.enabled": true,
    "feature.theme-engine.enabled": false,
    "feature.quick-polls.enabled": true,
    "feature.export.enabled": true,
    "feature.reminder-bot.enabled": true,
    "feature.personal-stats.enabled": true,
    "feature.profileHover": {
      selectedFields: ["display_name_extension", "role"],
      showAvatar: true,
      hoverDelayMs: 400
    },
    "feature.themeEngine": { preset: "none", customCss: "" },
    "feature.stickyPin": { pinnedIds: [] }
  };
  const existing = await chrome.storage.sync.get(Object.keys(defaults));
  const toSet = {};
  for (const [k, v] of Object.entries(defaults)) {
    if (existing[k] === undefined) toSet[k] = v;
  }
  if (Object.keys(toSet).length) await chrome.storage.sync.set(toSet);

  // Re-arm any pending reminders after extension reload/reinstall.
  await rescheduleAllReminders();
});

chrome.runtime.onStartup.addListener(rescheduleAllReminders);

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// --- Reminder-bot wiring ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "bkpr-reminder") return;
  if (msg.action === "schedule") {
    const delayMs = Math.max(0, msg.reminder.due - Date.now());
    chrome.alarms.create(msg.reminder.id, { when: Date.now() + delayMs });
    sendResponse({ ok: true });
  } else if (msg.action === "cancel") {
    chrome.alarms.clear(msg.id, () => sendResponse({ ok: true }));
    return true;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const got = await chrome.storage.local.get({ [REMINDER_STORE]: [] });
  const list = got[REMINDER_STORE] || [];
  const r = list.find((x) => x.id === alarm.name);
  if (!r) return;
  const langGot = await chrome.storage.sync.get({ "bkpr.language": "en" });
  const title = langGot["bkpr.language"] === "de" ? "Beekeeper-Erinnerung" : "Beekeeper reminder";
  const body = (r.message && r.message.text) ? r.message.text.slice(0, 200) : "Reminder";
  chrome.notifications.create(r.id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: body,
    priority: 2
  });
  // Remove from store
  const remaining = list.filter((x) => x.id !== r.id);
  await chrome.storage.local.set({ [REMINDER_STORE]: remaining });
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  // Try to open Beekeeper tab where reminder was set
  const tabs = await chrome.tabs.query({ url: "https://*.beekeeper.io/*" });
  if (tabs[0]) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  }
  chrome.notifications.clear(notifId);
});

async function rescheduleAllReminders() {
  const got = await chrome.storage.local.get({ [REMINDER_STORE]: [] });
  const list = got[REMINDER_STORE] || [];
  for (const r of list) {
    if (r.due > Date.now()) chrome.alarms.create(r.id, { when: r.due });
  }
}
