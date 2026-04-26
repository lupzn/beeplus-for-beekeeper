// Export options UI: 3 buttons that send commands to a Beekeeper tab.

(function () {
  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  async function trySendToTab(tabId, action) {
    return await chrome.tabs.sendMessage(tabId, { target: "bkpr-export", action });
  }

  async function waitTabComplete(tabId, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  }

  async function trigger(action) {
    const status = document.getElementById("bkpr-export-status");
    const tabs = await chrome.tabs.query({ url: "https://*.beekeeper.io/*" });
    if (!tabs.length) {
      if (status) status.textContent = "Erst Beekeeper in einem Tab öffnen.";
      return;
    }
    if (status) status.textContent = i18n("exportInProgress", "Export in progress...");

    // Pass 1: try all tabs as-is
    for (const tab of tabs) {
      try {
        const res = await trySendToTab(tab.id, action);
        if (res && res.ok) {
          if (status) status.textContent = i18n("exportDone", "Export fertig (siehe Downloads).");
          return;
        }
        if (res && res.error) {
          if (status) status.textContent = "Fehler: " + res.error;
          return;
        }
      } catch (_) { /* try next */ }
    }

    // Pass 2: reload all Beekeeper tabs, wait for complete, retry once
    if (status) status.textContent = "Lade Beekeeper-Tab neu (Extension wurde aktualisiert)...";
    for (const tab of tabs) {
      try { await chrome.tabs.reload(tab.id); } catch (_) {}
    }
    // Wait until first Beekeeper tab is complete
    await waitTabComplete(tabs[0].id);
    // Extra grace period for content scripts + page-script CSRF capture
    await new Promise((r) => setTimeout(r, 3000));

    if (status) status.textContent = "Erneuter Export-Versuch...";
    for (const tab of tabs) {
      try {
        const res = await trySendToTab(tab.id, action);
        if (res && res.ok) {
          if (status) status.textContent = i18n("exportDone", "Export fertig (siehe Downloads).");
          return;
        }
        if (res && res.error) {
          if (status) status.textContent = "Fehler: " + res.error;
          return;
        }
      } catch (err) {
        if (tab === tabs[tabs.length - 1]) {
          if (status) status.textContent = "Fehler nach Reload: " + (err.message || "kein Content-Script");
        }
      }
    }
  }

  function render(container) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "feature-settings";

    const buttons = [
      ["myProfile", "exportProfileBtn", "Export my profile (JSON)"],
      ["teamJson", "exportTeamBtn", "Export team profiles (JSON)"],
      ["teamCsv", "exportTeamCsvBtn", "Export team profiles (CSV)"]
    ];
    for (const [action, key, fb] of buttons) {
      const b = document.createElement("button");
      b.style.marginRight = "8px";
      b.style.marginBottom = "8px";
      b.textContent = i18n(key, fb);
      b.onclick = () => trigger(action);
      wrap.appendChild(b);
    }

    const status = document.createElement("div");
    status.id = "bkpr-export-status";
    status.className = "hint";
    status.style.marginTop = "8px";
    wrap.appendChild(status);

    container.appendChild(wrap);
  }

  window.BeePlusOptions.register({
    id: "export",
    name: "featureExport",
    description: "featureExportDesc",
    defaultEnabled: true,
    render
  });
})();
