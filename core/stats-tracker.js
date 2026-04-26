// Lightweight per-day activity counter, used by personal-stats feature.
// Other features can call BeePlus.stats.bump("messageSent") whenever they observe an event.

(function (root) {
  const KEY = "stats.daily";

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function hourKey() {
    return new Date().getHours();
  }

  async function bump(metric, n = 1) {
    const got = await chrome.storage.local.get({ [KEY]: {} });
    const data = got[KEY] || {};
    const day = todayKey();
    if (!data[day]) data[day] = { hours: {} };
    data[day][metric] = (data[day][metric] || 0) + n;
    const h = hourKey();
    data[day].hours[h] = (data[day].hours[h] || 0) + n;
    await chrome.storage.local.set({ [KEY]: data });
  }

  async function read() {
    const got = await chrome.storage.local.get({ [KEY]: {} });
    return got[KEY] || {};
  }

  async function reset() {
    await chrome.storage.local.set({ [KEY]: {} });
  }

  // Aggregate helpers
  function summarize(data) {
    const days = Object.keys(data).sort();
    const today = todayKey();
    const todayData = data[today] || {};
    const last7 = days.filter((d) => {
      const dt = new Date(d);
      const diff = (Date.now() - dt.getTime()) / 86400000;
      return diff <= 7;
    });
    const sum = (key) =>
      last7.reduce((a, d) => a + ((data[d] && data[d][key]) || 0), 0);
    const allTimeSum = (key) =>
      days.reduce((a, d) => a + ((data[d] && data[d][key]) || 0), 0);

    // Peak hour over all days
    const hourTotals = {};
    for (const d of days) {
      const hours = (data[d] && data[d].hours) || {};
      for (const h of Object.keys(hours)) hourTotals[h] = (hourTotals[h] || 0) + hours[h];
    }
    let peakHour = null, peakVal = 0;
    for (const h of Object.keys(hourTotals)) {
      if (hourTotals[h] > peakVal) { peakVal = hourTotals[h]; peakHour = h; }
    }

    return {
      today: {
        messagesSent: todayData.messageSent || 0,
        reactionsGiven: todayData.reactionGiven || 0
      },
      week: {
        messagesSent: sum("messageSent"),
        reactionsGiven: sum("reactionGiven"),
        activeDays: last7.filter((d) => {
          const dd = data[d] || {};
          return (dd.messageSent || 0) + (dd.reactionGiven || 0) > 0;
        }).length
      },
      allTime: {
        messagesSent: allTimeSum("messageSent"),
        reactionsGiven: allTimeSum("reactionGiven"),
        activeDays: days.length,
        peakHour: peakHour != null ? `${String(peakHour).padStart(2, "0")}:00` : "-"
      }
    };
  }

  root.BeePlus = root.BeePlus || {};
  root.BeePlus.stats = { bump, read, reset, summarize };
})(window);
