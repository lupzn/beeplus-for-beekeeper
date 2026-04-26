// Quick-Polls options UI: just a hint, no settings yet.
(function () {
  function i18n(k, fb) { return (window.BeePlusI18n && window.BeePlusI18n.t(k)) || fb; }

  function render(container) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = i18n("quickPollsHint", "Click the poll icon next to the composer.");
    container.appendChild(p);
  }

  window.BeePlusOptions.register({
    id: "quick-polls",
    name: "featureQuickPolls",
    description: "featureQuickPollsDesc",
    defaultEnabled: false,
    render
  });
})();
