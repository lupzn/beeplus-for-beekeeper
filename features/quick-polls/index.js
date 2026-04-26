// Feature: Quick Polls — adds a poll button to the message composer.
// Generates a formatted poll text (with emoji-numbered options) that recipients
// can vote on by reacting with the corresponding emoji.

(function () {
  const SETTINGS_KEY = "feature.quickPolls";
  const NUMBER_EMOJIS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

  let floatingBtn = null;
  let fabObserver = null;

  function i18n(k, fb) { try { return chrome.i18n.getMessage(k) || fb; } catch (_) { return fb; } }

  function buildPollText(question, options) {
    const header = `${i18n("pollEmoji", "📊")} ${question.trim()}`;
    const body = options
      .filter((o) => o && o.trim())
      .slice(0, 10)
      .map((o, i) => `${NUMBER_EMOJIS[i]} ${o.trim()}`)
      .join("\n");
    return `${header}\n\n${body}\n\n_(Reagiere mit der Zahl deiner Wahl)_`;
  }

  function openModal() {
    const overlay = document.createElement("div");
    overlay.className = "bkpr-poll-overlay";
    overlay.innerHTML = `
      <div class="bkpr-poll-modal">
        <h3>${escape(i18n("featureQuickPolls", "Schnell-Umfrage"))}</h3>
        <label>${escape(i18n("pollQuestionLabel", "Frage"))}</label>
        <input type="text" id="bkpr-poll-q" placeholder="z.B. Pizza-Party Donnerstag oder Freitag?">
        <label>${escape(i18n("pollOptionsLabel", "Optionen (eine pro Zeile)"))}</label>
        <textarea id="bkpr-poll-opts" rows="6" placeholder="Donnerstag\nFreitag\nKeine Pizza"></textarea>
        <div class="bkpr-poll-preview" id="bkpr-poll-preview"></div>
        <div class="bkpr-poll-actions">
          <button id="bkpr-poll-cancel">Abbrechen</button>
          <button id="bkpr-poll-copy">In Zwischenablage</button>
          <button id="bkpr-poll-insert" class="primary">In Composer einfuegen</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const q = overlay.querySelector("#bkpr-poll-q");
    const o = overlay.querySelector("#bkpr-poll-opts");
    const preview = overlay.querySelector("#bkpr-poll-preview");
    q.focus();

    function updatePreview() {
      const text = buildPollText(q.value || "Frage?", (o.value || "").split("\n"));
      preview.textContent = text;
    }
    q.oninput = updatePreview;
    o.oninput = updatePreview;
    updatePreview();

    overlay.querySelector("#bkpr-poll-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelector("#bkpr-poll-copy").onclick = async () => {
      const text = buildPollText(q.value, o.value.split("\n"));
      try {
        await navigator.clipboard.writeText(text);
        const btn = overlay.querySelector("#bkpr-poll-copy");
        btn.textContent = "Kopiert!";
        setTimeout(() => overlay.remove(), 800);
      } catch (e) {
        alert("Kopieren fehlgeschlagen. Markiere und kopiere die Vorschau manuell.");
      }
    };

    overlay.querySelector("#bkpr-poll-insert").onclick = async () => {
      if (!q.value.trim() || o.value.split("\n").filter((x) => x.trim()).length < 2) {
        alert("Mindestens 1 Frage + 2 Optionen.");
        return;
      }
      const text = buildPollText(q.value, o.value.split("\n"));
      // Close modal FIRST so its own textarea isn't picked up as the composer.
      overlay.remove();
      // Wait one frame so DOM removal settles + Beekeeper composer regains focus.
      await new Promise((r) => requestAnimationFrame(r));
      const ta = findAnyComposer();
      if (ta) {
        try { ta.focus(); } catch (_) {}
        window.BeePlus.dom.triggerInput(ta, text);
        console.log("[BeePlus quick-polls] inserted into composer:", ta);
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(text);
          alert("Composer nicht gefunden. Umfrage in Zwischenablage kopiert — Strg+V im Beekeeper-Composer.");
        } catch (e) {
          alert("Composer nicht gefunden und Kopieren fehlgeschlagen.\n\n" + text);
        }
      }
    };
  }

  // Lenient composer lookup. Excludes BeePlus modal contents.
  function findAnyComposer() {
    const isOurs = (el) => el && el.closest && el.closest(".bkpr-poll-overlay");
    const ae = document.activeElement;
    if (ae && (ae.tagName === "TEXTAREA" || ae.isContentEditable) && !isOurs(ae)) {
      return ae;
    }
    const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"]')]
      .filter((el) => !isOurs(el))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 100 && r.height > 20 && r.bottom > window.innerHeight * 0.4;
      });
    return candidates[candidates.length - 1] || null;
  }

  function escape(s) { return String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]); }

  function injectFloatingButton() {
    const existing = document.getElementById("bkpr-poll-fab");
    if (existing) existing.remove();
    floatingBtn = document.createElement("button");
    floatingBtn.id = "bkpr-poll-fab";
    floatingBtn.title = i18n("featureQuickPolls", "Schnell-Umfrage");
    floatingBtn.textContent = i18n("pollEmoji", "📊");
    floatingBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    floatingBtn.style.display = "none";
    document.body.appendChild(floatingBtn);
    console.log("[BeePlus quick-polls] FAB injected (hidden until composer detected)");
  }

  // Detect any composer-like input on the page (Beekeeper composer, comment box, etc.)
  function hasComposer() {
    const candidates = document.querySelectorAll('textarea, [contenteditable="true"]');
    for (const el of candidates) {
      // Exclude our own modal
      if (el.closest && el.closest(".bkpr-poll-overlay")) continue;
      // Exclude options page elements
      if (el.closest && el.closest(".feature-settings-panel")) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 100 && r.height > 18 && r.bottom > 0 && r.top < window.innerHeight) {
        return true;
      }
    }
    return false;
  }

  // Re-inject FAB if Beekeeper removed it; toggle visibility based on composer presence.
  function ensureFabPresent() {
    if (!document.getElementById("bkpr-poll-fab")) {
      injectFloatingButton();
    }
    const fab = document.getElementById("bkpr-poll-fab");
    if (!fab) return;
    fab.style.display = hasComposer() ? "flex" : "none";
  }

  function init() {
    if (!document.getElementById("bkpr-poll-style")) {
      const s = document.createElement("style");
      s.id = "bkpr-poll-style";
      s.textContent = `
        #bkpr-poll-fab {
          position: fixed; bottom: 100px; right: 24px;
          width: 44px; height: 44px;
          border-radius: 50%; border: none;
          background: #2563eb; color: #fff;
          font-size: 20px; cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 2147483646;
          align-items: center; justify-content: center;
          transition: transform 0.15s, background 0.15s, opacity 0.2s;
          opacity: 0.85;
        }
        #bkpr-poll-fab[style*="flex"] { display: flex !important; }
        #bkpr-poll-fab:hover { background: #1d4ed8; transform: scale(1.08); }
        .bkpr-poll-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2147483647; display:flex; align-items:center; justify-content:center; }
        .bkpr-poll-modal { background:#fff; border-radius:12px; padding:24px; width:520px; max-width:90vw; font-family:-apple-system,BlinkMacSystemFont,sans-serif; max-height:90vh; overflow-y:auto; }
        .bkpr-poll-modal h3 { margin:0 0 12px 0; font-size:16px; color:#111827; }
        .bkpr-poll-modal label { display:block; font-size:12px; color:#6b7280; margin:8px 0 4px 0; text-transform:uppercase; letter-spacing: 0.05em; }
        .bkpr-poll-modal input, .bkpr-poll-modal textarea { width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; box-sizing:border-box; }
        .bkpr-poll-modal textarea { font-family: monospace; resize: vertical; }
        .bkpr-poll-preview { margin-top:12px; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; white-space:pre-wrap; font-size:13px; line-height:1.5; max-height:200px; overflow-y:auto; }
        .bkpr-poll-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; flex-wrap:wrap; }
        .bkpr-poll-actions button { padding:8px 14px; border:1px solid #d1d5db; background:#fff; border-radius:6px; font-size:13px; cursor:pointer; }
        .bkpr-poll-actions button.primary { background:#2563eb; color:#fff; border-color:#2563eb; }
        .bkpr-poll-actions button:hover { background:#f3f4f6; }
        .bkpr-poll-actions button.primary:hover { background:#1d4ed8; }
      `;
      document.head.appendChild(s);
    }
    injectFloatingButton();
    ensureFabPresent();
    // Subtree observer: detect composer add/remove + body changes.
    let pending = false;
    fabObserver = window.BeePlus.dom.observe(document.body, { childList: true, subtree: true }, () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        ensureFabPresent();
      }, 200);
    });
  }

  function teardown() {
    if (fabObserver) fabObserver();
    if (floatingBtn) { floatingBtn.remove(); floatingBtn = null; }
    const fab = document.getElementById("bkpr-poll-fab");
    if (fab) fab.remove();
    document.querySelectorAll(".bkpr-poll-overlay").forEach((o) => o.remove());
    const s = document.getElementById("bkpr-poll-style");
    if (s) s.remove();
  }

  window.BeePlus.FeatureRegistry.register({
    id: "quick-polls",
    name: "featureQuickPolls",
    description: "featureQuickPollsDesc",
    defaultEnabled: true,
    settingsKey: SETTINGS_KEY,
    init,
    teardown
  });
})();
