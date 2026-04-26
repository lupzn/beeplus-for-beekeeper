// BeePlus Options-Page Feature Registry.
// Each feature's options-ui.js calls BeePlusOptions.register({...}) at load time.

(function (root) {
  const features = [];

  const BeePlusOptions = {
    register(def) {
      if (!def || !def.id) throw new Error("Feature options requires id");
      features.push(def);
    },
    list() { return features.slice(); },
    get(id) { return features.find((f) => f.id === id); }
  };

  root.BeePlusOptions = BeePlusOptions;
})(window);
