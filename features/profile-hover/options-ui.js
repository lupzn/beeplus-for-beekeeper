// Profile-Hover feature: settings UI for the BeePlus options page.

(function () {
  const SETTINGS_KEY = "feature.profileHover";
  const DEFAULTS = {
    selectedFields: ["display_name_extension", "role"],
    showAvatar: true,
    hoverDelayMs: 400
  };

  let knownFields = [];
  let fieldLabels = {};
  let selectedFields = [];
  let showAvatar = true;
  let hoverDelayMs = 400;

  function i18n(key, fb) {
    try { return chrome.i18n.getMessage(key) || fb; } catch (_) { return fb; }
  }

  function mergeUnique(...arrays) {
    const seen = new Set();
    const out = [];
    for (const arr of arrays) for (const v of arr || []) {
      if (!seen.has(v)) { seen.add(v); out.push(v); }
    }
    return out.sort();
  }

  async function load() {
    const sync = await chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULTS });
    const local = await chrome.storage.local.get({ knownFields: [], fieldLabels: {} });
    const stored = Object.assign({}, DEFAULTS, sync[SETTINGS_KEY] || {});
    selectedFields = stored.selectedFields;
    showAvatar = stored.showAvatar;
    hoverDelayMs = stored.hoverDelayMs;
    knownFields = mergeUnique(local.knownFields, selectedFields, Object.keys(DEFAULTS.selectedFields ? {} : {}));
    fieldLabels = local.fieldLabels || {};
  }

  async function save() {
    await chrome.storage.sync.set({
      [SETTINGS_KEY]: { selectedFields, showAvatar, hoverDelayMs }
    });
  }

  function render(container) {
    container.innerHTML = "";
    load().then(() => {
      const root = document.createElement("div");
      root.className = "feature-settings";

      // Display options
      root.appendChild(buildCheckbox(
        i18n("showAvatarLabel", "Show avatar in tooltip"),
        showAvatar,
        (v) => { showAvatar = v; save(); }
      ));

      // Hover delay
      root.appendChild(buildNumberInput(
        i18n("hoverDelayLabel", "Hover delay (ms)"),
        hoverDelayMs,
        (v) => { hoverDelayMs = v; save(); }
      ));

      // Fields
      const fhead = document.createElement("h3");
      fhead.textContent = i18n("fieldsSection", "Fields");
      root.appendChild(fhead);

      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = i18n("fieldsHint", "Fields appear here once the extension has loaded a first profile.");
      root.appendChild(hint);

      // Add custom field
      const addRow = document.createElement("div");
      addRow.className = "actions";
      const addInput = document.createElement("input");
      addInput.type = "text";
      addInput.placeholder = i18n("addFieldPlaceholder", "Add field key (e.g. custom.unterkunft)");
      const addBtn = document.createElement("button");
      addBtn.textContent = i18n("addBtn", "Add");
      addBtn.onclick = () => {
        const v = addInput.value.trim();
        if (!v) return;
        if (!knownFields.includes(v)) knownFields.push(v);
        if (!selectedFields.includes(v)) selectedFields.push(v);
        addInput.value = "";
        knownFields.sort();
        save();
        render(container);
      };
      addRow.appendChild(addInput);
      addRow.appendChild(addBtn);
      root.appendChild(addRow);

      // Field checkbox grid
      const grid = document.createElement("div");
      grid.id = "fieldList";
      knownFields.forEach((f) => {
        const lbl = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = selectedFields.includes(f);
        cb.onchange = () => {
          if (cb.checked) {
            if (!selectedFields.includes(f)) selectedFields.push(f);
          } else {
            selectedFields = selectedFields.filter((x) => x !== f);
          }
          save();
          render(container);
        };
        lbl.appendChild(cb);
        const friendly = fieldLabels[f] ? `${fieldLabels[f]} (${f})` : f;
        lbl.appendChild(document.createTextNode(" " + friendly));
        grid.appendChild(lbl);
      });
      root.appendChild(grid);

      // Order list (drag & drop)
      const ohead = document.createElement("h3");
      ohead.textContent = i18n("orderSection", "Order");
      root.appendChild(ohead);
      const ohint = document.createElement("p");
      ohint.className = "hint";
      ohint.textContent = i18n("orderHint", "Drag to reorder.");
      root.appendChild(ohint);

      const ul = document.createElement("ul");
      ul.id = "selectedOrder";
      selectedFields.forEach((f, idx) => {
        const li = document.createElement("li");
        li.draggable = true;
        li.dataset.index = String(idx);
        const friendly = fieldLabels[f] ? `${fieldLabels[f]} (${f})` : f;
        li.innerHTML = `<span>${friendly}</span><button data-remove="${f}">x</button>`;
        li.addEventListener("dragstart", () => { li.classList.add("dragging"); ul.dataset.src = String(idx); });
        li.addEventListener("dragover", (e) => e.preventDefault());
        li.addEventListener("drop", (e) => {
          e.preventDefault();
          const src = Number(ul.dataset.src);
          const tgt = Number(li.dataset.index);
          if (isNaN(src) || src === tgt) return;
          const [moved] = selectedFields.splice(src, 1);
          selectedFields.splice(tgt, 0, moved);
          save();
          render(container);
        });
        li.addEventListener("dragend", () => li.classList.remove("dragging"));
        ul.appendChild(li);
      });
      ul.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const f = e.target.dataset.remove;
          selectedFields = selectedFields.filter((x) => x !== f);
          save();
          render(container);
        });
      });
      root.appendChild(ul);

      container.appendChild(root);
    });
  }

  function buildCheckbox(label, checked, onChange) {
    const lbl = document.createElement("label");
    lbl.className = "checkbox";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = checked;
    cb.onchange = () => onChange(cb.checked);
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(" " + label));
    return lbl;
  }

  function buildNumberInput(label, value, onChange) {
    const wrap = document.createElement("label");
    wrap.className = "number-input";
    wrap.appendChild(document.createTextNode(label + " "));
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.max = "5000";
    inp.value = String(value);
    inp.onchange = () => onChange(parseInt(inp.value, 10) || 0);
    wrap.appendChild(inp);
    return wrap;
  }

  window.BeePlusOptions.register({
    id: "profile-hover",
    name: "featureProfileHover",
    description: "featureProfileHoverDesc",
    defaultEnabled: true,
    render
  });
})();
