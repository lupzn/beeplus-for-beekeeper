// Sticky-Pin settings: lists pinned chat IDs and allows unpinning.

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
    const UI = window.BeePlusUI;
    const { el, icon } = UI;
    container.textContent = "";
    const listHost = el("div");
    container.append(
      UI.notice(i18n("stickyPinHint", "Open Beekeeper, hover a chat and click the pin icon.")),
      UI.section(i18n("pinnedChatsLabel", "Pinned chats"), i18n("pinnedChatsDesc", "Pinned chats appear in this order above your chat list."), listHost)
    );

    refresh();

    // focusIndex: after an unpin, move focus to the row that took its place.
    async function refresh(focusIndex) {
      const ids = await getPinned();
      listHost.textContent = "";
      if (!ids.length) {
        listHost.appendChild(UI.emptyState("sticky-pin", i18n("noPinnedChats", "No chats pinned yet.")));
        if (focusIndex != null) { listHost.tabIndex = -1; listHost.focus(); }
        return;
      }
      const ul = el("ul", { class: "list" });
      ids.forEach((id, i) => {
        ul.appendChild(el("li", { class: "list-item" },
          el("span", { class: "badge", text: String(i + 1) }),
          el("span", { class: "list-item-icon" }, icon("sticky-pin", { size: 18 })),
          el("div", { class: "list-item-body" },
            el("div", { class: "list-item-title mono", text: id, attrs: { title: id } }),
            el("div", { class: "list-item-meta", text: i18n("chatIdLabel", "Chat ID") })
          ),
          UI.iconButton("x", `${i18n("unpinBtn", "Unpin")}: ${id}`, async () => {
            const cur = await getPinned();
            await setPinned(cur.filter((x) => x !== id));
            refresh(i);
          }, { danger: true })
        ));
      });
      listHost.appendChild(ul);
      if (focusIndex != null) {
        const btns = ul.querySelectorAll(".icon-btn");
        const btn = btns[Math.min(focusIndex, btns.length - 1)];
        if (btn) btn.focus();
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
