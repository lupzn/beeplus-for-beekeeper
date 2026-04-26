// Personal Stats options UI: summary cards + hourly bar chart, matching the
// Chrome Web Store mockup styling.

(function () {
  const KEY = "stats.daily";
  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function summarize(data) {
    const days = Object.keys(data).sort();
    const today = todayKey();
    const todayData = data[today] || {};
    const last7 = days.filter((d) => (Date.now() - new Date(d).getTime()) / 86400000 <= 7);
    const sum = (key) => last7.reduce((a, d) => a + ((data[d] && data[d][key]) || 0), 0);
    const all = (key) => days.reduce((a, d) => a + ((data[d] && data[d][key]) || 0), 0);

    const hourTotals = {};
    for (let h = 0; h < 24; h++) hourTotals[h] = 0;
    for (const d of days) {
      const hours = (data[d] && data[d].hours) || {};
      for (const k of Object.keys(hours)) hourTotals[k] = (hourTotals[k] || 0) + hours[k];
    }
    let peak = null, pv = 0;
    for (const h of Object.keys(hourTotals)) {
      if (hourTotals[h] > pv) { pv = hourTotals[h]; peak = h; }
    }

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
        peakHour: peak != null ? `${String(peak).padStart(2,"0")}:00` : "-",
        peakHourNum: peak != null ? Number(peak) : null
      },
      hourTotals
    };
  }

  function statCard(title, rows) {
    const el = document.createElement("div");
    el.className = "ps-card";
    const h = document.createElement("div");
    h.className = "ps-card-title";
    h.textContent = title;
    el.appendChild(h);
    for (const [label, val, big] of rows) {
      const row = document.createElement("div");
      row.className = "ps-row";
      const lbl = document.createElement("span");
      lbl.className = "ps-lbl";
      lbl.textContent = label;
      const v = document.createElement("strong");
      v.className = big ? "ps-val big" : "ps-val";
      v.textContent = val;
      row.appendChild(lbl);
      row.appendChild(v);
      el.appendChild(row);
    }
    return el;
  }

  function buildChart(hourTotals, peakHourNum) {
    // Show working hours 6-22 (16 bars). Adjust if data is outside.
    const startHour = 6, endHour = 22;
    const max = Math.max(1, ...Object.values(hourTotals));

    const wrap = document.createElement("div");
    wrap.className = "ps-chart-section";
    const title = document.createElement("h3");
    title.textContent = i18n("statsHourlyTitle", "Hourly activity (peak hour highlighted)");
    wrap.appendChild(title);
    const sub = document.createElement("div");
    sub.className = "ps-chart-sub";
    sub.textContent = i18n("statsHourlySub", "When you send the most messages");
    wrap.appendChild(sub);

    const bars = document.createElement("div");
    bars.className = "ps-bars";
    for (let h = startHour; h <= endHour; h++) {
      const bar = document.createElement("div");
      bar.className = "ps-bar";
      if (h === peakHourNum) bar.classList.add("peak");
      const ratio = (hourTotals[h] || 0) / max;
      bar.style.height = `${Math.max(4, Math.round(ratio * 100))}%`;
      bar.dataset.hour = h;
      bar.title = `${String(h).padStart(2, "0")}:00 — ${hourTotals[h] || 0}`;
      bars.appendChild(bar);
    }
    wrap.appendChild(bars);
    return wrap;
  }

  function injectStyle() {
    if (document.getElementById("bkpr-ps-style")) return;
    const s = document.createElement("style");
    s.id = "bkpr-ps-style";
    s.textContent = `
      .ps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
      .ps-card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px 18px;
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      }
      .ps-card-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        margin-bottom: 10px;
      }
      .ps-row {
        display: flex; justify-content: space-between;
        padding: 5px 0;
        font-size: 13px;
      }
      .ps-lbl { color: #64748b; }
      .ps-val { font-weight: 700; color: #1a202c; font-variant-numeric: tabular-nums; }
      .ps-val.big { font-size: 20px; color: #2563eb; }

      .ps-chart-section {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 16px;
      }
      .ps-chart-section h3 { font-size: 13px; color: #1a202c; margin-bottom: 4px; }
      .ps-chart-sub { font-size: 12px; color: #64748b; margin-bottom: 16px; }
      .ps-bars {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        height: 110px;
        padding-bottom: 18px;
      }
      .ps-bar {
        flex: 1;
        background: linear-gradient(180deg, #2563eb 0%, #7c3aed 100%);
        border-radius: 4px 4px 0 0;
        min-height: 4px;
        position: relative;
      }
      .ps-bar::after {
        content: attr(data-hour);
        position: absolute;
        bottom: -18px; left: 0; right: 0;
        text-align: center;
        font-size: 10px; color: #94a3b8;
      }
      .ps-bar.peak {
        background: linear-gradient(180deg, #f59e0b 0%, #ef4444 100%);
      }
      .ps-reset-btn {
        margin-top: 4px;
      }
      .ps-empty {
        text-align: center;
        padding: 20px;
        color: #94a3b8;
        font-size: 13px;
        font-style: italic;
      }
    `;
    document.head.appendChild(s);
  }

  function render(container) {
    injectStyle();
    container.innerHTML = "";

    refresh();

    async function refresh() {
      const got = await chrome.storage.local.get({ [KEY]: {} });
      const summary = summarize(got[KEY] || {});
      container.innerHTML = "";

      const totalAll = summary.allTime.messagesSent + summary.allTime.reactionsGiven;

      const grid = document.createElement("div");
      grid.className = "ps-grid";
      grid.appendChild(statCard(i18n("statsTodayLabel", "Today"), [
        [i18n("statsMessagesSent", "Messages sent"), summary.today.messagesSent, true],
        [i18n("statsReactionsGiven", "Reactions given"), summary.today.reactionsGiven, false]
      ]));
      grid.appendChild(statCard(i18n("statsWeekLabel", "This week"), [
        [i18n("statsMessagesSent", "Messages sent"), summary.week.messagesSent, true],
        [i18n("statsReactionsGiven", "Reactions given"), summary.week.reactionsGiven, false],
        [i18n("statsActiveDays", "Active days"), summary.week.activeDays, false]
      ]));
      grid.appendChild(statCard(i18n("statsAllTimeLabel", "All time"), [
        [i18n("statsMessagesSent", "Messages sent"), summary.allTime.messagesSent.toLocaleString(), true],
        [i18n("statsReactionsGiven", "Reactions given"), summary.allTime.reactionsGiven.toLocaleString(), false],
        [i18n("statsActiveDays", "Active days"), summary.allTime.activeDays, false],
        [i18n("statsPeakHour", "Peak hour"), summary.allTime.peakHour, false]
      ]));
      container.appendChild(grid);

      if (totalAll === 0) {
        const empty = document.createElement("div");
        empty.className = "ps-empty";
        empty.textContent = i18n("statsEmpty", "No activity yet — chat in Beekeeper to start tracking.");
        container.appendChild(empty);
      } else {
        container.appendChild(buildChart(summary.hourTotals, summary.allTime.peakHourNum));
      }

      const reset = document.createElement("button");
      reset.className = "ps-reset-btn";
      reset.textContent = i18n("statsResetBtn", "Reset all stats");
      reset.onclick = async () => {
        if (!confirm(i18n("statsResetConfirm", "Really reset all stats?"))) return;
        await chrome.storage.local.set({ [KEY]: {} });
        refresh();
      };
      container.appendChild(reset);
    }
  }

  window.BeePlusOptions.register({
    id: "personal-stats",
    name: "featurePersonalStats",
    description: "featurePersonalStatsDesc",
    defaultEnabled: true,
    render
  });
})();
