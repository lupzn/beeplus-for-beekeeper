// Personal Stats settings: summary cards + hourly activity chart.

(function () {
  const KEY = "stats.daily";
  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }
  function lang() { return (window.BeePlusI18n && window.BeePlusI18n.getLanguage()) || "en"; }
  const fmt = (n) => Number(n || 0).toLocaleString(lang());
  const hh = (h) => `${String(h).padStart(2, "0")}:00`;

  function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function lastNDayKeys(n) {
    const keys = new Set();
    for (let i = 0; i < n; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keys.add(dayKey(d));
    }
    return keys;
  }

  function summarize(data) {
    const days = Object.keys(data).sort();
    const todayData = data[dayKey(new Date())] || {};
    const week = lastNDayKeys(7);
    const last7 = days.filter((d) => week.has(d));
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
      if (hourTotals[h] > pv) { pv = hourTotals[h]; peak = Number(h); }
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
        peakHour: peak
      },
      hourTotals
    };
  }

  function statCard(el, title, big, rows) {
    return el("div", { class: "stat-card" },
      el("div", { class: "stat-label", text: title }),
      el("div", { class: "stat-big", text: fmt(big) }),
      el("div", { class: "stat-big-label", text: i18n("statsMessagesSent", "Messages sent") }),
      ...rows.map(([label, val]) => el("div", { class: "stat-row" }, el("span", { text: label }), el("strong", { text: val })))
    );
  }

  function buildChart(el, hourTotals, peakHour) {
    const used = Object.keys(hourTotals).filter((h) => hourTotals[h] > 0).map(Number);
    const start = Math.min(6, ...used);
    const end = Math.max(22, ...used);
    const max = Math.max(1, ...Object.values(hourTotals));

    const cols = [];
    const axis = [];
    const rows = [];
    for (let h = start; h <= end; h++) {
      const v = hourTotals[h] || 0;
      const pct = v ? Math.max(2, Math.round((v / max) * 100)) : 0;
      const isPeak = h === peakHour;
      const col = el("div", { class: "bar-col" },
        el("div", { class: "bar-tip", text: `${hh(h)} · ${fmt(v)}` }),
        isPeak ? el("div", { class: "bar-peak-label", text: fmt(v) }) : null,
        el("div", { class: "bar" + (isPeak ? " peak" : "") })
      );
      col.style.setProperty("--h", `${pct}%`);
      col.lastChild.style.height = `${pct}%`;
      cols.push(col);
      axis.push(el("span", { text: String(h) }));
      rows.push(el("tr", {}, el("th", { text: hh(h), attrs: { scope: "row" } }), el("td", { text: fmt(v) })));
    }

    return el("div", { class: "chart" },
      el("div", { class: "chart-head" },
        el("div", {},
          el("div", { class: "chart-title", text: i18n("statsHourlyTitle", "Activity by hour") }),
          el("div", { class: "chart-sub", text: i18n("statsHourlySub", "Messages and reactions per hour, across all days") })
        ),
        peakHour != null
          ? el("span", { class: "chart-key" }, el("i", { attrs: { "aria-hidden": "true" } }), `${i18n("statsPeakHour", "Peak hour")}: ${hh(peakHour)}`)
          : null
      ),
      el("div", { class: "bars", attrs: { "aria-hidden": "true" } }, ...cols),
      el("div", { class: "bar-axis", attrs: { "aria-hidden": "true" } }, ...axis),
      // Tables ignore height/overflow, so sr-only goes on a wrapper.
      el("div", { class: "sr-only" },
        el("table", {},
          el("caption", { text: i18n("statsHourlyTitle", "Activity by hour") }),
          el("thead", {}, el("tr", {},
            el("th", { text: i18n("statsHourCol", "Hour"), attrs: { scope: "col" } }),
            el("th", { text: i18n("statsCountCol", "Activity"), attrs: { scope: "col" } })
          )),
          el("tbody", {}, ...rows)
        )
      )
    );
  }

  function render(container) {
    const UI = window.BeePlusUI;
    const { el } = UI;
    container.textContent = "";
    refresh();

    async function refresh() {
      const got = await chrome.storage.local.get({ [KEY]: {} });
      const s = summarize(got[KEY] || {});
      container.textContent = "";

      container.appendChild(el("div", { class: "stat-grid" },
        statCard(el, i18n("statsTodayLabel", "Today"), s.today.messagesSent, [
          [i18n("statsReactionsGiven", "Reactions given"), fmt(s.today.reactionsGiven)]
        ]),
        statCard(el, i18n("statsWeekLabel", "Last 7 days"), s.week.messagesSent, [
          [i18n("statsReactionsGiven", "Reactions given"), fmt(s.week.reactionsGiven)],
          [i18n("statsActiveDays", "Active days"), fmt(s.week.activeDays)]
        ]),
        statCard(el, i18n("statsAllTimeLabel", "All time"), s.allTime.messagesSent, [
          [i18n("statsReactionsGiven", "Reactions given"), fmt(s.allTime.reactionsGiven)],
          [i18n("statsActiveDays", "Active days"), fmt(s.allTime.activeDays)],
          [i18n("statsPeakHour", "Peak hour"), s.allTime.peakHour != null ? hh(s.allTime.peakHour) : "–"]
        ])
      ));

      const total = s.allTime.messagesSent + s.allTime.reactionsGiven;
      container.appendChild(total === 0
        ? UI.emptyState("personal-stats", i18n("statsEmpty", "No activity yet."))
        : buildChart(el, s.hourTotals, s.allTime.peakHour));

      const reset = UI.button(i18n("statsResetBtn", "Reset all stats"), {
        icon: "trash",
        variant: "danger",
        onClick: async () => {
          if (!confirm(i18n("statsResetConfirm", "Really reset all stats?"))) return;
          await chrome.storage.local.set({ [KEY]: {} });
          await refresh();
          container.tabIndex = -1;
          container.focus();
          UI.toast(i18n("statsResetDone", "Statistics reset."));
        }
      });
      reset.disabled = total === 0;
      container.appendChild(el("div", { class: "actions-row" }, reset));
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
