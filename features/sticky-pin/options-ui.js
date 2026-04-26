// Options UI for sticky-pin: lists currently pinned chat UUIDs and allows removal.

(function () {
  const SETTINGS_KEY = "feature.stickyPin";

  function i18n(key, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(key)) || fb; }

  async function getPinned() {
    const got = await chrome.storage.sync.get({ [SETTINGS_KEY]: { pinnedIds: [] } });
    return (got[SETTINGS_KEY] && got[SETTINGS_KEY].pinnedIds) || [];
  }

  async function setPinned(ids) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { pinnedIds: ids } });
  }

  function render(container) {
    container.innerHTML = "";
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = i18n("stickyPinHint", "Open Beekeeper, hover a chat → click the pin icon.");
    container.appendChild(hint);

    const head = document.createElement("h3");
    head.textContent = i18n("pinnedChatsLabel", "Pinned chats");
    container.appendChild(head);

    const ul = document.createElement("ul");
    ul.className = "pinned-list";
    container.appendChild(ul);

    refresh();

    async function refresh() {
      const ids = await getPinned();
      ul.innerHTML = "";
      if (!ids.length) {
        const empty = document.createElement("p");
        empty.className = "hint";
        empty.textContent = i18n("noPinnedChats", "No chats pinned yet.");
        ul.appendChild(empty);
        return;
      }
      for (const id of ids) {
        const li = document.createElement("li");
        li.style.cssText = "padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;display:flex;justify-content:space-between;margin:4px 0;font-family:monospace;font-size:12px;";
        const span = document.createElement("span");
        span.textContent = id;
        const btn = document.createElement("button");
        btn.textContent = i18n("removePin", "Remove");
        btn.onclick = async () => {
          const cur = await getPinned();
          await setPinned(cur.filter((x) => x !== id));
          refresh();
        };
        li.appendChild(span);
        li.appendChild(btn);
        ul.appendChild(li);
      }
    }
  }

  window.BeePlusOptions.register({
    id: "sticky-pin",
    name: "featureStickyPin",
    description: "featureStickyPinDesc",
    defaultEnabled: true,
    render
  });
})();
