// Quick-Polls settings: no options yet, just a short how-to.
(function () {
  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  function render(container) {
    const UI = window.BeePlusUI;
    const { el } = UI;
    container.textContent = "";
    const steps = [
      i18n("pollStep1", "Open a chat so the message field is visible."),
      i18n("pollStep2", "Click the round poll button in the bottom-right corner."),
      i18n("pollStep3", "Enter a question and one option per line, then insert the poll."),
      i18n("pollStep4", "Everyone votes by reacting with the number of their choice.")
    ];
    container.append(
      UI.section(i18n("howItWorks", "How it works"), null,
        el("ol", { class: "steps" },
          ...steps.map((s, i) => el("li", {},
            el("span", { class: "badge badge-brand", text: String(i + 1) }),
            el("span", { text: s })
          ))
        )
      )
    );
  }

  window.BeePlusOptions.register({
    id: "quick-polls",
    name: "featureQuickPolls",
    description: "featureQuickPollsDesc",
    defaultEnabled: false,
    render
  });
})();
