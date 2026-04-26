// Feature: Export Everything — fetches profile data and triggers a local download.
// All work happens in-browser. Does not upload anywhere.
//
// Note: Beekeeper does not expose a "download all my messages" endpoint via the
// SPA REST API. We focus on profile / team-profile export. Message history
// export would require iterating each stream's /messages endpoint and is left
// as a future enhancement (would need pagination + rate limiting).

(function () {
  const SETTINGS_KEY = "feature.export";

  function init() {}
  function teardown() {}

  // Register handler EAGERLY on module load (not in init), so it works even if
  // the feature toggle is off — export is a pure on-demand action triggered
  // from the options page; it has no UI to disable.
  function registerExportHandler() {
    if (!window.BeePlus.registerMessageHandler) {
      // content.js not yet loaded — retry shortly
      setTimeout(registerExportHandler, 100);
      return;
    }
    window.BeePlus.registerMessageHandler("bkpr-export", async (msg) => {
      if (msg.action === "myProfile") await exportMyProfile();
      else if (msg.action === "teamJson") await exportTeamJson();
      else if (msg.action === "teamCsv") await exportTeamCsv();
      else throw new Error("Unknown export action: " + msg.action);
      return { ok: true };
    });
  }
  registerExportHandler();

  // Public helpers used by options-ui:
  async function exportMyProfile() {
    const me = await fetchSelf();
    const data = await window.BeePlus.api.fetchProfile(me.id);
    const stamp = new Date().toISOString().slice(0, 10);
    window.BeePlus.dom.downloadJson(`beekeeper-my-profile-${stamp}.json`, data);
  }

  async function exportTeamJson() {
    const profiles = await fetchAllProfiles();
    const stamp = new Date().toISOString().slice(0, 10);
    window.BeePlus.dom.downloadJson(`beekeeper-team-${stamp}.json`, profiles);
  }

  async function exportTeamCsv() {
    const profiles = await fetchAllProfiles();
    // Flatten: collect all custom-field keys across users, build header row.
    const cfKeys = new Set();
    for (const p of profiles) {
      const u = p.user || p;
      (u.custom_fields || []).forEach((f) => f.key && cfKeys.add(f.key));
    }
    const cfList = [...cfKeys];
    const header = ["id", "display_name", "name", "firstname", "lastname", "role", "created", ...cfList.map((k) => `custom.${k}`)];
    const rows = [header];
    for (const p of profiles) {
      const u = p.user || p;
      const row = [u.id, u.display_name, u.name, u.firstname, u.lastname, u.role, u.created];
      for (const k of cfList) {
        const cf = (u.custom_fields || []).find((f) => f.key === k);
        let v = cf ? cf.value : "";
        if (v && typeof v === "object") v = v.display_name || v.name || JSON.stringify(v);
        row.push(v);
      }
      rows.push(row);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    window.BeePlus.dom.downloadCsv(`beekeeper-team-${stamp}.csv`, rows);
  }

  async function fetchSelf() {
    const res = await fetch("/api/2/self", {
      credentials: "include",
      headers: bkprAuthHeaders()
    });
    if (!res.ok) throw new Error(`Failed to load self: ${res.status}`);
    return await res.json();
  }

  async function fetchAllProfiles() {
    // Bulk profiles endpoint with pagination
    const out = [];
    const limit = 100;
    let offset = 0;
    while (true) {
      const url = `/api/2/profiles?include_bots=false&include_hidden_bots=false&limit=${limit}&offset=${offset}`;
      const res = await fetch(url, { credentials: "include", headers: bkprAuthHeaders() });
      if (!res.ok) {
        console.warn("[BeePlus export] profiles list error", res.status);
        break;
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.profiles || data.users || []);
      if (!arr.length) break;
      out.push(...arr);
      if (arr.length < limit) break;
      offset += limit;
      // Be polite — small delay between pages.
      await new Promise((r) => setTimeout(r, 200));
    }
    return out;
  }

  function bkprAuthHeaders() {
    // Mirror bkpr-api headers. CSRF is captured by core/bkpr-api.js into a
    // shared window-message channel; we read it here from the same listener
    // by storing it on a small shim.
    const csrf = window.__bkprCsrfShim || null;
    const h = {
      "accept": "application/vnd.io.beekeeper.customfields+json;version=2",
      "authorization": "Cookie",
      "x-bkpr-app-name": "app-web",
      "x-requested-with": "XMLHttpRequest"
    };
    if (csrf) h["x-csrf-token"] = csrf;
    return h;
  }

  // Listen on the same channel as bkpr-api to keep our own CSRF shim updated.
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "bkpr-ext") return;
    if (e.data.type === "csrf" && e.data.value) window.__bkprCsrfShim = e.data.value;
  });

  window.BeePlus.exportFeature = { exportMyProfile, exportTeamJson, exportTeamCsv };

  window.BeePlus.FeatureRegistry.register({
    id: "export",
    name: "featureExport",
    description: "featureExportDesc",
    defaultEnabled: true,
    settingsKey: SETTINGS_KEY,
    init,
    teardown
  });
})();
