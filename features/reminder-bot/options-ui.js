// Reminder-Bot options UI: list of active reminders with delete buttons.

(function () {
  const STORE_KEY = "reminders.list";
  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  function render(container) {
    container.innerHTML = "";
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = i18n("reminderHint", "Right-click on a message → ‘Remind me…’");
    container.appendChild(hint);

    const head = document.createElement("h3");
    head.textContent = i18n("activeRemindersLabel", "Active reminders");
    container.appendChild(head);

    const list = document.createElement("ul");
    list.style.cssText = "list-style:none;padding:0;margin:0;";
    container.appendChild(list);

    refresh();

    async function refresh() {
      const got = await chrome.storage.local.get({ [STORE_KEY]: [] });
      const items = (got[STORE_KEY] || []).filter((r) => r.due > Date.now()).sort((a, b) => a.due - b.due);
      list.innerHTML = "";
      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "hint";
        empty.textContent = i18n("noActiveReminders", "No active reminders.");
        list.appendChild(empty);
        return;
      }
      for (const r of items) {
        const li = document.createElement("li");
        li.style.cssText = "padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;margin:4px 0;display:flex;justify-content:space-between;gap:8px;align-items:center;";
        const text = document.createElement("div");
        text.style.flex = "1";
        text.innerHTML = `<div style="font-size:12px;color:#6b7280;">${new Date(r.due).toLocaleString()}</div><div style="font-size:13px;">${escape(r.message.text || "(no text)")}</div>`;
        const btn = document.createElement("button");
        btn.textContent = "×";
        btn.title = "Cancel reminder";
        btn.onclick = async () => {
          const cur = await chrome.storage.local.get({ [STORE_KEY]: [] });
          const filtered = (cur[STORE_KEY] || []).filter((x) => x.id !== r.id);
          await chrome.storage.local.set({ [STORE_KEY]: filtered });
          await chrome.runtime.sendMessage({ target: "bkpr-reminder", action: "cancel", id: r.id });
          refresh();
        };
        li.appendChild(text);
        li.appendChild(btn);
        list.appendChild(li);
      }
    }
  }

  function escape(s) { return String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]); }

  window.BeePlusOptions.register({
    id: "reminder-bot",
    name: "featureReminderBot",
    description: "featureReminderBotDesc",
    defaultEnabled: true,
    render
  });
})();
