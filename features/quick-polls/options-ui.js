// Quick-Polls options UI: just a hint, no settings yet.
(function () {
  function i18n(k, fb) { try { return chrome.i18n.getMessage(k) || fb; } catch (_) { return fb; } }

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
