// BeePlus options UI kit: SVG icon set + small DOM builders shared by the
// options shell and every feature's options-ui.js. Options page only.

(function (root) {
  const NS = "http://www.w3.org/2000/svg";
  const FILL = { fill: "currentColor", stroke: "none" };

  // 24x24 grid, 1.75 stroke, round caps. Tuples of [tag, attrs].
  const ICONS = {
    overview: [
      ["rect", { x: 3.5, y: 3.5, width: 7, height: 7, rx: 1.75 }],
      ["rect", { x: 13.5, y: 3.5, width: 7, height: 7, rx: 1.75 }],
      ["rect", { x: 3.5, y: 13.5, width: 7, height: 7, rx: 1.75 }],
      ["rect", { x: 13.5, y: 13.5, width: 7, height: 7, rx: 1.75 }]
    ],
    "profile-hover": [
      ["rect", { x: 2.75, y: 4.75, width: 18.5, height: 14.5, rx: 2.5 }],
      ["circle", { cx: 8.75, cy: 10.5, r: 2.25 }],
      ["path", { d: "M5.5 16.25c.7-1.5 1.85-2.25 3.25-2.25S11.3 14.75 12 16.25" }],
      ["path", { d: "M14.75 9.75h3.75" }],
      ["path", { d: "M14.75 13.25h2.75" }]
    ],
    "sticky-pin": [
      ["path", { d: "M9 3.5h6" }],
      ["path", { d: "M10 3.5v5.25l-3.2 3.6a1 1 0 0 0-.3.7v1.45h11v-1.45a1 1 0 0 0-.3-.7L14 8.75V3.5" }],
      ["path", { d: "M12 14.5v6" }]
    ],
    "quick-polls": [
      ["rect", { x: 3.5, y: 4, width: 11, height: 3.5, rx: 1.75 }],
      ["rect", { x: 3.5, y: 10.25, width: 17, height: 3.5, rx: 1.75 }],
      ["rect", { x: 3.5, y: 16.5, width: 7, height: 3.5, rx: 1.75 }]
    ],
    "personal-stats": [
      ["path", { d: "M3.5 3.5v15a2 2 0 0 0 2 2h15" }],
      ["path", { d: "M7.5 15l3.5-4 3 2.5 5-6" }]
    ],
    "reminder-bot": [
      ["circle", { cx: 12, cy: 13, r: 7.5 }],
      ["path", { d: "M12 9.5V13l2.25 2" }],
      ["path", { d: "M4.75 3.5 2.5 5.75" }],
      ["path", { d: "M19.25 3.5l2.25 2.25" }]
    ],
    "theme-engine": [
      ["path", { d: "M4 7h8.5" }],
      ["path", { d: "M17.5 7H20" }],
      ["circle", { cx: 15, cy: 7, r: 2.5 }],
      ["path", { d: "M4 17h2.5" }],
      ["path", { d: "M11.5 17H20" }],
      ["circle", { cx: 9, cy: 17, r: 2.5 }]
    ],
    hexagon: [["path", { d: "M12 2.75 20 7.375v9.25L12 21.25l-8-4.625v-9.25L12 2.75z" }]],
    plus: [["path", { d: "M12 5v14" }], ["path", { d: "M5 12h14" }]],
    "chevron-right": [["path", { d: "M9.5 6l6 6-6 6" }]],
    "chevron-left": [["path", { d: "M14.5 6l-6 6 6 6" }]],
    "chevron-up": [["path", { d: "M6 14.5l6-6 6 6" }]],
    "chevron-down": [["path", { d: "M6 9.5l6 6 6-6" }]],
    shield: [
      ["path", { d: "M12 3 19 6v5.2c0 4.3-2.9 8-7 9.8-4.1-1.8-7-5.5-7-9.8V6l7-3z" }],
      ["path", { d: "M9 12l2 2 4-4" }]
    ],
    heart: [["path", { d: "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" }]],
    star: [["path", { d: "M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5z" }]],
    github: [["path", Object.assign({
      d: "M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
    }, FILL)]],
    external: [
      ["path", { d: "M14 4h6v6" }],
      ["path", { d: "M20 4l-8.5 8.5" }],
      ["path", { d: "M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5" }]
    ],
    info: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M12 11v5" }], ["path", { d: "M12 7.75h.01" }]],
    x: [["path", { d: "M6.5 6.5l11 11" }], ["path", { d: "M17.5 6.5l-11 11" }]],
    trash: [
      ["path", { d: "M4 7h16" }],
      ["path", { d: "M9.5 7V4.5h5V7" }],
      ["path", { d: "M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12" }]
    ],
    grip: [
      ["circle", Object.assign({ cx: 9, cy: 6, r: 1.4 }, FILL)],
      ["circle", Object.assign({ cx: 15, cy: 6, r: 1.4 }, FILL)],
      ["circle", Object.assign({ cx: 9, cy: 12, r: 1.4 }, FILL)],
      ["circle", Object.assign({ cx: 15, cy: 12, r: 1.4 }, FILL)],
      ["circle", Object.assign({ cx: 9, cy: 18, r: 1.4 }, FILL)],
      ["circle", Object.assign({ cx: 15, cy: 18, r: 1.4 }, FILL)]
    ],
    check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
    terminal: [
      ["rect", { x: 3, y: 4.5, width: 18, height: 15, rx: 2.5 }],
      ["path", { d: "M7 9.5l3 2.5-3 2.5" }],
      ["path", { d: "M12.5 15h4.5" }]
    ],
    refresh: [["path", { d: "M20 12a8 8 0 1 1-2.35-5.65" }], ["path", { d: "M20 4.5V9h-4.5" }]],
    globe: [
      ["circle", { cx: 12, cy: 12, r: 9 }],
      ["path", { d: "M3 12h18" }],
      ["path", { d: "M12 3c2.5 2.6 3.75 5.6 3.75 9S14.5 18.4 12 21c-2.5-2.6-3.75-5.6-3.75-9S9.5 5.6 12 3z" }]
    ],
    lightbulb: [
      ["path", { d: "M9 18h6" }],
      ["path", { d: "M10 21h4" }],
      ["path", { d: "M12 3a6 6 0 0 0-3.6 10.8c.7.55 1.1 1.3 1.1 2.2h5c0-.9.4-1.65 1.1-2.2A6 6 0 0 0 12 3z" }]
    ],
    scale: [
      ["path", { d: "M12 4v16" }],
      ["path", { d: "M7 20h10" }],
      ["path", { d: "M5 8h14" }],
      ["path", { d: "M5 8l-2.5 6a3 3 0 0 0 5 0L5 8z" }],
      ["path", { d: "M19 8l-2.5 6a3 3 0 0 0 5 0L19 8z" }]
    ],
    code: [["path", { d: "M8.5 7 3.5 12l5 5" }], ["path", { d: "M15.5 7l5 5-5 5" }]],
    user: [["circle", { cx: 12, cy: 8, r: 4 }], ["path", { d: "M4.5 20.5c1.3-3.4 4.1-5 7.5-5s6.2 1.6 7.5 5" }]],
    tag: [["path", { d: "M3.5 12.1V4.5a1 1 0 0 1 1-1h7.6a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7z" }], ["circle", Object.assign({ cx: 8, cy: 8, r: 1.5 }, FILL)]]
  };

  function icon(name, opts) {
    const o = opts || {};
    const def = ICONS[name] || ICONS.hexagon;
    const size = String(o.size || 20);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", String(o.stroke || 1.75));
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "icon" + (o.className ? " " + o.className : ""));
    for (const [tag, attrs] of def) {
      const node = document.createElementNS(NS, tag);
      for (const k of Object.keys(attrs)) node.setAttribute(k, String(attrs[k]));
      svg.appendChild(node);
    }
    return svg;
  }

  // el("div", { class, text, attrs: {...}, on: { click } }, ...children)
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    const p = props || {};
    if (p.class) node.className = p.class;
    if (p.text != null) node.textContent = p.text;
    if (p.attrs) for (const k of Object.keys(p.attrs)) {
      const v = p.attrs[k];
      if (v === false || v == null) continue;
      node.setAttribute(k, v === true ? "" : String(v));
    }
    if (p.on) for (const ev of Object.keys(p.on)) node.addEventListener(ev, p.on[ev]);
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  function switchControl({ checked, label, onChange, small }) {
    const input = el("input", { attrs: { type: "checkbox", role: "switch", "aria-label": label } });
    input.checked = !!checked;
    input.addEventListener("change", () => onChange && onChange(input.checked));
    const wrap = el("label", { class: "switch" + (small ? " switch-sm" : "") }, input, el("span", { class: "switch-track" }));
    wrap.input = input;
    return wrap;
  }

  function button(text, opts) {
    const o = opts || {};
    const b = el("button", {
      class: "btn" + (o.variant ? " btn-" + o.variant : ""),
      attrs: { type: "button", title: o.title }
    });
    if (o.icon) b.appendChild(icon(o.icon, { size: 16 }));
    if (text) b.appendChild(el("span", { text }));
    if (o.onClick) b.addEventListener("click", o.onClick);
    return b;
  }

  function iconButton(name, label, onClick, opts) {
    const o = opts || {};
    const b = el("button", {
      class: "icon-btn" + (o.danger ? " icon-btn-danger" : ""),
      attrs: { type: "button", title: label, "aria-label": label }
    }, icon(name, { size: 16 }));
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  function section(title, desc, ...children) {
    return el("section", { class: "set-section" },
      title ? el("h3", { class: "set-title", text: title }) : null,
      desc ? el("p", { class: "set-desc", text: desc }) : null,
      ...children
    );
  }

  function settingRow(title, desc, control) {
    return el("div", { class: "set-row" },
      el("div", { class: "set-row-text" },
        el("div", { class: "set-row-title", text: title }),
        desc ? el("div", { class: "set-row-desc", text: desc }) : null
      ),
      el("div", { class: "set-row-control" }, control)
    );
  }

  function notice(text, opts) {
    const o = opts || {};
    return el("div", { class: "notice" + (o.tone ? " notice-" + o.tone : ""), attrs: { role: "note" } },
      icon(o.icon || "info", { size: 18 }),
      el("p", { text })
    );
  }

  function emptyState(iconName, text) {
    return el("div", { class: "empty" },
      el("span", { class: "empty-icon" }, icon(iconName, { size: 22 })),
      el("p", { text })
    );
  }

  let toastTimer = null;
  function toast(text, iconName) {
    let region = document.getElementById("toastRegion");
    if (!region) {
      region = el("div", { class: "toast-region", attrs: { id: "toastRegion", role: "status", "aria-live": "polite" } });
      document.body.appendChild(region);
    }
    region.textContent = "";
    const t = el("div", { class: "toast" }, icon(iconName || "check", { size: 16 }), el("span", { text }));
    region.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 250);
    }, 2600);
  }

  root.BeePlusUI = { icon, el, switchControl, button, iconButton, section, settingRow, notice, emptyState, toast, ICONS };
})(window);
