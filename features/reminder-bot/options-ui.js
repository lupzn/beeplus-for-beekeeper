// Reminder-Bot settings: upcoming reminders with cancel buttons.

(function () {
  const STORE_KEY = "reminders.list";
  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }
  function lang() { return (window.BeePlusI18n && window.BeePlusI18n.getLanguage()) || "en"; }

  function relative(due) {
    const rtf = new Intl.RelativeTimeFormat(lang(), { numeric: "auto" });
    const min = Math.round((due - Date.now()) / 60000);
    if (min < 60) return rtf.format(Math.max(min, 1), "minute");
    const hours = Math.round(min / 60);
    if (hours < 48) return rtf.format(hours, "hour");
    return rtf.format(Math.round(hours / 24), "day");
  }

  function absolute(due) {
    return new Date(due).toLocaleString(lang(), {
      weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  }

  function render(container) {
    const UI = window.BeePlusUI;
    const { el, icon } = UI;
    container.textContent = "";
    const listHost = el("div");
    container.append(
      UI.notice(i18n("reminderHint", "Right-click a message in Beekeeper, choose \"Remind me\" and pick a time.")),
      UI.section(i18n("activeRemindersLabel", "Active reminders"), null, listHost)
    );

    refresh();

    // focusIndex: after a delete, move focus to the row that took its place.
    async function refresh(focusIndex) {
      const got = await chrome.storage.local.get({ [STORE_KEY]: [] });
      const items = (got[STORE_KEY] || []).filter((r) => r.due > Date.now()).sort((a, b) => a.due - b.due);
      listHost.textContent = "";
      if (!items.length) {
        listHost.appendChild(UI.emptyState("reminder-bot", i18n("noActiveReminders", "No active reminders.")));
        if (focusIndex != null) { listHost.tabIndex = -1; listHost.focus(); }
        return;
      }
      const ul = el("ul", { class: "list" });
      items.forEach((r, i) => {
        const text = (r.message && r.message.text) || i18n("reminderNoText", "(no text)");
        ul.appendChild(el("li", { class: "list-item" },
          el("span", { class: "list-item-icon" }, icon("reminder-bot", { size: 18 })),
          el("div", { class: "list-item-body" },
            el("div", { class: "list-item-title", text, attrs: { title: text } }),
            el("div", { class: "list-item-meta", text: `${relative(r.due)} · ${absolute(r.due)}` })
          ),
          UI.iconButton("trash", `${i18n("cancelReminder", "Cancel reminder")}: ${text}`, async () => {
            const cur = await chrome.storage.local.get({ [STORE_KEY]: [] });
            await chrome.storage.local.set({ [STORE_KEY]: (cur[STORE_KEY] || []).filter((x) => x.id !== r.id) });
            try {
              await chrome.runtime.sendMessage({ target: "bkpr-reminder", action: "cancel", id: r.id });
            } catch (_) {}
            refresh(i);
          }, { danger: true })
        ));
      });
      listHost.appendChild(ul);
      if (focusIndex != null) {
        const btns = ul.querySelectorAll(".icon-btn");
        const btn = btns[Math.min(focusIndex, btns.length - 1)];
        if (btn) btn.focus();
      }
    }
  }

  window.BeePlusOptions.register({
    id: "reminder-bot",
    name: "featureReminderBot",
    description: "featureReminderBotDesc",
    defaultEnabled: true,
    render
  });
})();
