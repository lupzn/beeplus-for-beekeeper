// Profile-Hover settings: display options, field picker and field order.

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

  function i18n(key, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(key)) || fb; }

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
    knownFields = mergeUnique(local.knownFields, selectedFields);
    fieldLabels = local.fieldLabels || {};
  }

  async function save() {
    await chrome.storage.sync.set({
      [SETTINGS_KEY]: { selectedFields, showAvatar, hoverDelayMs }
    });
  }

  // Custom-field label from Beekeeper, else the translated built-in name, else the raw key.
  const labelFor = (f) => fieldLabels[f] || i18n("field." + f, null) || f;

  function render(container) {
    const UI = window.BeePlusUI;
    const { el, icon } = UI;
    container.textContent = "";

    load().then(() => {
      const chipsHost = el("div");
      const orderHost = el("div");

      // The content script treats 0 as "use default", so 50 ms is the floor.
      const delay = el("input", {
        class: "input",
        attrs: { type: "number", min: 50, max: 5000, step: 50, inputmode: "numeric", "aria-label": `${i18n("hoverDelayLabel", "Hover delay")} (ms)` }
      });
      delay.value = String(hoverDelayMs);
      delay.addEventListener("change", () => {
        const n = Number(delay.value);
        const v = delay.value.trim() !== "" && Number.isFinite(n) ? Math.min(5000, Math.max(50, Math.round(n))) : hoverDelayMs;
        delay.value = String(v);
        hoverDelayMs = v;
        save();
      });

      const addInput = el("input", {
        class: "input",
        attrs: {
          type: "text",
          placeholder: i18n("addFieldPlaceholder", "Field key, e.g. custom.unterkunft"),
          "aria-label": i18n("addFieldPlaceholder", "Field key")
        }
      });
      const addField = () => {
        const v = addInput.value.trim();
        if (!v) return;
        if (!knownFields.includes(v)) { knownFields.push(v); knownFields.sort(); }
        if (!selectedFields.includes(v)) selectedFields.push(v);
        addInput.value = "";
        save();
        renderChips();
        renderOrder();
        addInput.focus();
      };
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); addField(); }
      });

      container.append(
        UI.section(i18n("displaySection", "Display"), null,
          UI.settingRow(
            i18n("showAvatarLabel", "Show profile picture"),
            i18n("showAvatarDesc", "Shows the avatar at the top of the card."),
            UI.switchControl({
              checked: showAvatar,
              small: true,
              label: i18n("showAvatarLabel", "Show profile picture"),
              onChange: (v) => { showAvatar = v; save(); }
            })
          ),
          UI.settingRow(
            i18n("hoverDelayLabel", "Hover delay"),
            i18n("hoverDelayDesc", "How long the pointer rests on an avatar before the card appears."),
            el("div", { class: "input-group" }, delay, el("span", { class: "input-suffix", text: "ms" }))
          )
        ),
        UI.section(i18n("fieldsSection", "Fields"), i18n("fieldsHint", "Fields appear once a first profile has loaded."),
          el("div", { class: "inline-form" }, addInput, UI.button(i18n("addBtn", "Add"), { icon: "plus", onClick: addField })),
          chipsHost
        ),
        UI.section(i18n("orderSection", "Order"), i18n("orderHint", "Drag to reorder."), orderHost)
      );

      renderChips();
      renderOrder();

      function renderChips() {
        chipsHost.textContent = "";
        if (!knownFields.length) {
          chipsHost.appendChild(UI.emptyState("profile-hover", i18n("fieldsEmpty", "No fields known yet.")));
          return;
        }
        chipsHost.appendChild(el("div", { class: "chip-grid" }, ...knownFields.map(fieldChip)));
      }

      function fieldChip(f) {
        const cb = el("input", { attrs: { type: "checkbox", "data-field": f } });
        cb.checked = selectedFields.includes(f);
        cb.addEventListener("change", () => {
          if (cb.checked) {
            if (!selectedFields.includes(f)) selectedFields.push(f);
          } else {
            selectedFields = selectedFields.filter((x) => x !== f);
          }
          save();
          renderOrder();
        });
        return el("label", { class: "field-chip", attrs: { title: f } },
          cb,
          el("span", { class: "chip-check" }, icon("check", { size: 12, stroke: 2.5 })),
          el("span", { class: "chip-text", text: labelFor(f) }),
          labelFor(f) !== f ? el("span", { class: "chip-key", text: f }) : null
        );
      }

      function move(from, to, focusAction) {
        if (to < 0 || to >= selectedFields.length || from === to) return;
        const [moved] = selectedFields.splice(from, 1);
        selectedFields.splice(to, 0, moved);
        save();
        renderOrder();
        if (focusAction) {
          const li = orderHost.querySelectorAll(".list-item")[to];
          const btn = li && (li.querySelector(`[data-action="${focusAction}"]:not(:disabled)`) || li.querySelector("[data-action]:not(:disabled)"));
          if (btn) btn.focus();
        }
      }

      function removeField(f) {
        const idx = selectedFields.indexOf(f);
        selectedFields = selectedFields.filter((x) => x !== f);
        save();
        const cb = chipsHost.querySelector(`input[data-field="${CSS.escape(f)}"]`);
        if (cb) cb.checked = false;
        renderOrder();
        const rows = orderHost.querySelectorAll(".list-item");
        const next = rows[Math.min(idx, rows.length - 1)];
        const target = next ? next.querySelector('[data-action="remove"]') : addInput;
        if (target) target.focus();
      }

      function renderOrder() {
        orderHost.textContent = "";
        if (!selectedFields.length) {
          orderHost.appendChild(UI.emptyState("grip", i18n("orderEmpty", "Select fields above to show them in the card.")));
          return;
        }
        const ul = el("ul", { class: "list" });
        selectedFields.forEach((f, idx) => {
          const up = UI.iconButton("chevron-up", i18n("moveUp", "Move up"), () => move(idx, idx - 1, "up"));
          const down = UI.iconButton("chevron-down", i18n("moveDown", "Move down"), () => move(idx, idx + 1, "down"));
          up.dataset.action = "up";
          down.dataset.action = "down";
          up.disabled = idx === 0;
          down.disabled = idx === selectedFields.length - 1;
          const remove = UI.iconButton("x", `${i18n("removeBtn", "Remove")}: ${labelFor(f)}`, () => removeField(f), { danger: true });
          remove.dataset.action = "remove";

          const li = el("li", { class: "list-item", attrs: { draggable: "true" } },
            el("span", { class: "drag-handle", attrs: { "aria-hidden": "true" } }, icon("grip", { size: 16 })),
            el("span", { class: "badge", text: String(idx + 1) }),
            el("div", { class: "list-item-body" },
              el("div", { class: "list-item-title", text: labelFor(f) }),
              labelFor(f) !== f ? el("div", { class: "list-item-meta mono", text: f }) : null
            ),
            el("div", { class: "list-item-actions" }, up, down, remove)
          );
          li.addEventListener("dragstart", (e) => {
            ul.dataset.src = String(idx);
            li.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(idx));
          });
          li.addEventListener("dragend", () => {
            li.classList.remove("dragging");
            delete ul.dataset.src;
            ul.querySelectorAll(".drag-over").forEach((n) => n.classList.remove("drag-over"));
          });
          li.addEventListener("dragover", (e) => {
            if (ul.dataset.src === undefined) return;
            e.preventDefault();
            li.classList.add("drag-over");
          });
          li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
          li.addEventListener("drop", (e) => {
            e.preventDefault();
            li.classList.remove("drag-over");
            if (ul.dataset.src === undefined) return;
            const src = Number(ul.dataset.src);
            delete ul.dataset.src;
            move(src, idx);
          });
          ul.appendChild(li);
        });
        orderHost.appendChild(ul);
      }
    });
  }

  window.BeePlusOptions.register({
    id: "profile-hover",
    name: "featureProfileHover",
    description: "featureProfileHoverDesc",
    defaultEnabled: true,
    render
  });
})();
