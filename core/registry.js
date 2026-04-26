// BeePlus Feature Registry
// Each feature module calls FeatureRegistry.register({...}) at load time.
// The runtime initializes only enabled features (toggle in Options page).
//
// Feature manifest:
// {
//   id:         string (unique slug, e.g. "profile-hover")
//   name:       i18n key for human-readable name
//   description i18n key for description
//   defaultEnabled: bool
//   init:       async function(ctx) called on enabled features
//   teardown:   optional async function() called when feature disabled
//   settingsKey: storage.sync key namespace (e.g. "feature.profileHover")
//   renderSettings: optional (container) => void  for per-feature options UI
// }

(function (root) {
  const features = new Map();
  const initialized = new Set();
  let ctx = null;

  const FeatureRegistry = {
    register(def) {
      if (!def || !def.id) throw new Error("Feature requires id");
      if (features.has(def.id)) {
        console.warn("[BeePlus] feature already registered:", def.id);
        return;
      }
      features.set(def.id, def);
    },

    list() {
      return [...features.values()];
    },

    get(id) {
      return features.get(id);
    },

    async getEnabledMap() {
      const defaults = {};
      for (const f of features.values()) {
        defaults[`feature.${f.id}.enabled`] = f.defaultEnabled !== false;
      }
      return await chrome.storage.sync.get(defaults);
    },

    async setEnabled(id, enabled) {
      await chrome.storage.sync.set({ [`feature.${id}.enabled`]: enabled });
      const f = features.get(id);
      if (!f) return;
      if (enabled && !initialized.has(id)) {
        await tryInit(f);
      } else if (!enabled && initialized.has(id) && f.teardown) {
        try { await f.teardown(); } catch (e) { console.error(`[BeePlus] teardown ${id}:`, e); }
        initialized.delete(id);
      }
    },

    async initAll(context) {
      ctx = context;
      const enabled = await FeatureRegistry.getEnabledMap();
      for (const f of features.values()) {
        if (enabled[`feature.${f.id}.enabled`]) await tryInit(f);
      }
    }
  };

  async function tryInit(f) {
    try {
      if (typeof f.init === "function") await f.init(ctx);
      initialized.add(f.id);
      console.log(`[BeePlus] feature initialized: ${f.id}`);
    } catch (e) {
      console.error(`[BeePlus] init ${f.id}:`, e);
    }
  }

  root.BeePlus = root.BeePlus || {};
  root.BeePlus.FeatureRegistry = FeatureRegistry;
})(typeof window !== "undefined" ? window : self);
