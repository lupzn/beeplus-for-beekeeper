// Custom in-page i18n dictionary. Independent of chrome.i18n so the user
// can switch language at runtime via the options page without re-installing.
// chrome.i18n is still used for the manifest name/description (set at install).

(function (root) {
  const STORAGE_KEY = "bkpr.language";
  const DEFAULT_LANG = "en";
  let currentLang = DEFAULT_LANG;
  const subscribers = new Set();

  const DICT = {
    en: {
      // Shell
      optionsHeading: "BeePlus for Beekeeper",
      optionsIntro: "Productivity add-ons. Toggle features individually.",
      featuresSection: "Features",
      moreSoonTitle: "More coming soon",
      moreSoonDesc: "Send-later, reactions, voice-to-text, and more.",
      donationTitle: "Like this extension?",
      donationText: "BeePlus is free and open-source. If it saves you time, consider supporting:",
      donationPaypalBtn: "♥ PayPal Donate",
      donationGithubBtn: "⭐ Star on GitHub",
      privacyNote: "🔒 Privacy: all data stays in your browser. No tracking, no analytics.",
      aboutBy: "BeePlus for Beekeeper – by LUPZN",
      langLabel: "Language",
      langEn: "English",
      langDe: "Deutsch",
      configureBtn: "Configure",
      hideBtn: "Hide",
      saveBtn: "Save",
      savedStatus: "Saved.",
      cancelBtn: "Cancel",
      addBtn: "Add",
      removeBtn: "Remove",

      // Feature names + descriptions
      featureProfileHover: "Profile Hover Tooltip",
      featureProfileHoverDesc: "Hover any avatar to see configurable profile fields.",
      featureStickyPin: "Sticky Pinned Chats",
      featureStickyPinDesc: "Keep important chats at the top of your list.",
      featureQuickPolls: "Quick Polls",
      featureQuickPollsDesc: "Create numbered-emoji polls from the composer.",
      featurePersonalStats: "Personal Stats",
      featurePersonalStatsDesc: "Track your own activity locally — never transmitted.",
      featureReminderBot: "Reminder Bot",
      featureReminderBotDesc: "Right-click a message to snooze it for later.",
      featureExport: "Export Everything",
      featureExportDesc: "Download own + team profiles as JSON or CSV.",
      featureThemeEngine: "Theme Tweaks",
      featureThemeEngineDesc: "Compact, larger font, accessibility, custom CSS.",

      // Profile-Hover settings
      showAvatarLabel: "Show avatar in tooltip",
      hoverDelayLabel: "Hover delay (ms)",
      fieldsSection: "Fields",
      fieldsHint: "Fields appear here once the extension has loaded a first profile. If empty, hover over a profile picture in Beekeeper, then reload this page.",
      addFieldPlaceholder: "Add field key (e.g. custom.unterkunft)",
      orderSection: "Order",
      orderHint: "Drag to reorder.",

      // Tooltip messages
      tooltipLoading: "Loading profile...",
      tooltipEmpty: "No fields with values found.",

      // Sticky-Pin
      stickyPinHint: "Open Beekeeper, hover a chat → click the pin icon.",
      pinnedChatsLabel: "Pinned chats",
      noPinnedChats: "No chats pinned yet.",

      // Theme
      themePresetLabel: "Preset",
      themePresetNone: "None (default)",
      themePresetCompact: "Compact",
      themePresetReading: "Reading (serif font)",
      themePresetLargerFont: "Larger font (accessibility)",
      themePresetFocusOutline: "Strong focus outline (accessibility)",
      themePresetMinimalReactions: "Hide reaction counts",
      themePresetCustom: "Custom CSS",
      themeNote: "ℹ️ Beekeeper has its own dark theme (Beekeeper Settings → Theme). BeePlus tweaks below = layout/font/accessibility only.",
      customCssPlaceholder: "/* Custom CSS targeting *.beekeeper.io */",
      applyThemeBtn: "Apply",

      // Quick Polls
      quickPollsHint: "Click the floating poll button (bottom-right) when a composer is visible.",

      // Export
      exportProfileBtn: "Export my profile (JSON)",
      exportTeamBtn: "Export team profiles (JSON)",
      exportTeamCsvBtn: "Export team profiles (CSV)",
      exportInProgress: "Export in progress...",
      exportDone: "Export ready (check Downloads).",
      exportNoTab: "Open Beekeeper in a tab first.",

      // Reminder Bot
      reminderHint: "Right-click on a message in Beekeeper → 'Remind me…' → choose duration.",
      activeRemindersLabel: "Active reminders",
      noActiveReminders: "No active reminders.",
      reminderIn5m: "In 5 minutes",
      reminderIn30m: "In 30 minutes",
      reminderIn1h: "In 1 hour",
      reminderIn3h: "In 3 hours",
      reminderTomorrow: "Tomorrow morning",
      reminderCustom: "Custom...",
      reminderNotifTitle: "Beekeeper reminder",

      // Stats
      statsTodayLabel: "Today",
      statsWeekLabel: "This week",
      statsAllTimeLabel: "All time",
      statsMessagesSent: "Messages sent",
      statsReactionsGiven: "Reactions given",
      statsActiveDays: "Active days",
      statsPeakHour: "Most active hour",
      statsResetBtn: "Reset all stats",
      statsResetConfirm: "Really reset all stats?",

      // Debug
      debugSection: "Debug",
      clearCacheBtn: "Clear cache + known fields"
    },

    de: {
      optionsHeading: "BeePlus für Beekeeper",
      optionsIntro: "Produktivitäts-Add-ons. Funktionen einzeln an/aus.",
      featuresSection: "Funktionen",
      moreSoonTitle: "Mehr in Kürze",
      moreSoonDesc: "Send-later, Reactions, Voice-to-Text und mehr.",
      donationTitle: "Gefällt dir die Extension?",
      donationText: "BeePlus ist kostenlos und Open-Source. Wenn es dir Zeit spart, freut sich der Entwickler über Support:",
      donationPaypalBtn: "♥ PayPal Spende",
      donationGithubBtn: "⭐ Auf GitHub starren",
      privacyNote: "🔒 Datenschutz: alle Daten bleiben im Browser. Kein Tracking, keine Analyse.",
      aboutBy: "BeePlus für Beekeeper – von LUPZN",
      langLabel: "Sprache",
      langEn: "English",
      langDe: "Deutsch",
      configureBtn: "Einstellungen",
      hideBtn: "Schließen",
      saveBtn: "Speichern",
      savedStatus: "Gespeichert.",
      cancelBtn: "Abbrechen",
      addBtn: "Hinzufügen",
      removeBtn: "Entfernen",

      featureProfileHover: "Profil-Hover Tooltip",
      featureProfileHoverDesc: "Maus über Avatar → konfigurierbare Profil-Felder.",
      featureStickyPin: "Pinnbare Chats",
      featureStickyPinDesc: "Wichtige Chats bleiben oben in der Liste.",
      featureQuickPolls: "Schnell-Umfragen",
      featureQuickPollsDesc: "Umfragen mit Zahlen-Emojis direkt aus dem Composer.",
      featurePersonalStats: "Persönliche Statistiken",
      featurePersonalStatsDesc: "Eigene Aktivität lokal verfolgen — wird nie übertragen.",
      featureReminderBot: "Erinnerungs-Bot",
      featureReminderBotDesc: "Rechtsklick auf Nachricht → später erinnern.",
      featureExport: "Alles exportieren",
      featureExportDesc: "Eigenes Profil + Team-Profile als JSON oder CSV herunterladen.",
      featureThemeEngine: "Theme-Tweaks",
      featureThemeEngineDesc: "Kompakt, größere Schrift, Accessibility, eigenes CSS.",

      showAvatarLabel: "Avatar im Tooltip anzeigen",
      hoverDelayLabel: "Hover-Verzögerung (ms)",
      fieldsSection: "Felder",
      fieldsHint: "Felder erscheinen hier, sobald die Extension das erste Profil geladen hat. Falls leer: Maus über ein Profilbild in Beekeeper bewegen, dann diese Seite neu laden.",
      addFieldPlaceholder: "Feld hinzufügen (z.B. custom.unterkunft)",
      orderSection: "Reihenfolge",
      orderHint: "Drag &amp; Drop zum Sortieren.",

      tooltipLoading: "Lade Profil...",
      tooltipEmpty: "Keine Felder mit Werten gefunden.",

      stickyPinHint: "Beekeeper öffnen, mit Maus über Chat → Pin-Symbol klicken.",
      pinnedChatsLabel: "Gepinnte Chats",
      noPinnedChats: "Noch keine Chats angepinnt.",

      themePresetLabel: "Vorlage",
      themePresetNone: "Keine (Standard)",
      themePresetCompact: "Kompakt",
      themePresetReading: "Lesemodus (Serif-Font)",
      themePresetLargerFont: "Größere Schrift (Accessibility)",
      themePresetFocusOutline: "Starker Fokus-Rahmen (Accessibility)",
      themePresetMinimalReactions: "Reaction-Counter ausblenden",
      themePresetCustom: "Eigenes CSS",
      themeNote: "ℹ️ Beekeeper hat eigenen Dark-Mode (Beekeeper Settings → Theme). BeePlus-Tweaks hier = nur Layout/Font/Accessibility.",
      customCssPlaceholder: "/* Eigenes CSS für *.beekeeper.io */",
      applyThemeBtn: "Anwenden",

      quickPollsHint: "Klick auf den schwebenden Umfrage-Button (unten rechts), wenn ein Composer sichtbar ist.",

      exportProfileBtn: "Mein Profil exportieren (JSON)",
      exportTeamBtn: "Team-Profile exportieren (JSON)",
      exportTeamCsvBtn: "Team-Profile exportieren (CSV)",
      exportInProgress: "Export läuft...",
      exportDone: "Export fertig (siehe Downloads).",
      exportNoTab: "Erst Beekeeper in einem Tab öffnen.",

      reminderHint: "Rechtsklick auf eine Nachricht in Beekeeper → 'Erinnere mich...' → Zeitraum wählen.",
      activeRemindersLabel: "Aktive Erinnerungen",
      noActiveReminders: "Keine aktiven Erinnerungen.",
      reminderIn5m: "In 5 Minuten",
      reminderIn30m: "In 30 Minuten",
      reminderIn1h: "In 1 Stunde",
      reminderIn3h: "In 3 Stunden",
      reminderTomorrow: "Morgen früh",
      reminderCustom: "Eigene Zeit...",
      reminderNotifTitle: "Beekeeper-Erinnerung",

      statsTodayLabel: "Heute",
      statsWeekLabel: "Diese Woche",
      statsAllTimeLabel: "Insgesamt",
      statsMessagesSent: "Nachrichten gesendet",
      statsReactionsGiven: "Reactions vergeben",
      statsActiveDays: "Aktive Tage",
      statsPeakHour: "Aktivste Stunde",
      statsResetBtn: "Alle Statistiken zurücksetzen",
      statsResetConfirm: "Wirklich alle Statistiken zurücksetzen?",

      debugSection: "Debug",
      clearCacheBtn: "Cache + bekannte Felder löschen"
    }
  };

  function t(key) {
    return (DICT[currentLang] && DICT[currentLang][key]) || DICT.en[key] || key;
  }

  async function loadLanguage() {
    try {
      const got = await chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_LANG });
      currentLang = got[STORAGE_KEY] === "de" ? "de" : "en";
    } catch (_) {
      currentLang = DEFAULT_LANG;
    }
    return currentLang;
  }

  async function setLanguage(lang) {
    currentLang = lang === "de" ? "de" : "en";
    try { await chrome.storage.sync.set({ [STORAGE_KEY]: currentLang }); } catch (_) {}
    subscribers.forEach((cb) => { try { cb(currentLang); } catch (_) {} });
  }

  function getLanguage() { return currentLang; }

  function onChange(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  // React to storage changes from other tabs (sync across windows)
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes[STORAGE_KEY]) {
        currentLang = changes[STORAGE_KEY].newValue === "de" ? "de" : "en";
        subscribers.forEach((cb) => { try { cb(currentLang); } catch (_) {} });
      }
    });
  }

  root.BeePlusI18n = { t, loadLanguage, setLanguage, getLanguage, onChange, DICT };
})(typeof window !== "undefined" ? window : self);
