// Personal Stats options UI: shows summary cards.

(function () {
  const KEY = "stats.daily";
  function i18n(k, fb) { try { return chrome.i18n.getMessage(k) || fb; } catch (_) { return fb; } }

  function render(container) {
    container.innerHTML = "";
    refresh();

    async function refresh() {
      const got = await chrome.storage.local.get({ [KEY]: {} });
      const summary = summarize(got[KEY] || {});

      container.innerHTML = "";

      const grid = document.createElement("div");
      grid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;";

      grid.appendChild(card(i18n("statsTodayLabel", "Today"), [
        [i18n("statsMessagesSent", "Messages sent"), summary.today.messagesSent],
        [i18n("statsReactionsGiven", "Reactions given"), summary.today.reactionsGiven]
      ]));

      grid.appendChild(card(i18n("statsWeekLabel", "This week"), [
        [i18n("statsMessagesSent", "Messages sent"), summary.week.messagesSent],
        [i18n("statsReactionsGiven", "Reactions given"), summary.week.reactionsGiven],
        [i18n("statsActiveDays", "Active days"), summary.week.activeDays]
      ]));

      grid.appendChild(card(i18n("statsAllTimeLabel", "All time"), [
        [i18n("statsMessagesSent", "Messages sent"), summary.allTime.messagesSent],
        [i18n("statsReactionsGiven", "Reactions given"), summary.allTime.reactionsGiven],
        [i18n("statsActiveDays", "Active days"), summary.allTime.activeDays],
        [i18n("statsPeakHour", "Most active hour"), summary.allTime.peakHour]
      ]));

      container.appendChild(grid);

      const reset = document.createElement("button");
      reset.textContent = i18n("statsResetBtn", "Reset all stats");
      reset.onclick = async () => {
        if (!confirm("Wirklich alle Statistiken zurücksetzen?")) return;
        await chrome.storage.local.set({ [KEY]: {} });
        refresh();
      };
      container.appendChild(reset);
    }
  }

  function card(title, rows) {
    const el = document.createElement("div");
    el.style.cssText = "border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;background:#fafafa;";
    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:8px;";
    el.appendChild(h);
    for (const [label, val] of rows) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;font-size:13px;padding:2px 0;";
      const lbl = document.createElement("span");
      lbl.style.color = "#6b7280";
      lbl.textContent = label;
      const v = document.createElement("strong");
      v.textContent = val;
      row.appendChild(lbl);
      row.appendChild(v);
      el.appendChild(row);
    }
    return el;
  }

  function summarize(data) {
    // Mirror logic from stats-tracker.js (options page can't import it cleanly).
    const days = Object.keys(data).sort();
    const todayKey = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    })();
    const todayData = data[todayKey] || {};
    const last7 = days.filter((d) => (Date.now() - new Date(d).getTime()) / 86400000 <= 7);
    const sum = (key) => last7.reduce((a, d) => a + ((data[d] && data[d][key]) || 0), 0);
    const all = (key) => days.reduce((a, d) => a + ((data[d] && data[d][key]) || 0), 0);

    const hourTotals = {};
    for (const d of days) {
      const h = (data[d] && data[d].hours) || {};
      for (const k of Object.keys(h)) hourTotals[k] = (hourTotals[k] || 0) + h[k];
    }
    let peak = null, pv = 0;
    for (const h of Object.keys(hourTotals)) if (hourTotals[h] > pv) { pv = hourTotals[h]; peak = h; }

    return {
      today: {
        messagesSent: todayData.messageSent || 0,
        reactionsGiven: todayData.reactionGiven || 0
      },
      week: {
        messagesSent: sum("messageSent"),
        reactionsGiven: sum("reactionGiven"),
        activeDays: last7.filter((d) => ((data[d] && (data[d].messageSent || data[d].reactionGiven)) || 0) > 0).length
      },
      allTime: {
        messagesSent: all("messageSent"),
        reactionsGiven: all("reactionGiven"),
        activeDays: days.length,
        peakHour: peak != null ? `${String(peak).padStart(2,"0")}:00` : "-"
      }
    };
  }

  window.BeePlusOptions.register({
    id: "personal-stats",
    name: "featurePersonalStats",
    description: "featurePersonalStatsDesc",
    defaultEnabled: true,
    render
  });
})();
