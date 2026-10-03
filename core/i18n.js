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
      brandSub: "for Beekeeper by LumApps",
      navLabel: "Settings navigation",
      navOverview: "Overview",
      navFeatures: "Features",
      navMore: "More",
      navAbout: "About & support",
      heroEyebrow: "BeePlus",
      heroTitle: "Get more out of Beekeeper by LumApps",
      heroText: "Six add-ons for the Beekeeper web app. Turn each one on or off, no setup needed.",
      heroActive: "{n} of {total} active",
      heroLocal: "No tracking, no servers of our own",
      featuresSection: "Features",
      featuresHint: "Open a card to adjust its settings.",
      statusOn: "Active",
      statusOff: "Off",
      settingsCta: "Settings",
      settingsTitle: "Settings",
      toggleAria: "Turn {name} on or off",
      toastEnabled: "{name} is on.",
      toastDisabled: "{name} is off.",
      toastReload: "Open Beekeeper tabs are reloading.",
      moreSoonTitle: "More on the way",
      moreSoonDesc: "Send later, reactions, voice-to-text and other ideas are on the roadmap.",
      suggestFeature: "Suggest a feature",
      supportTitle: "Free and open source",
      supportText: "BeePlus is a side project by LUPZN. If it saves you time, a GitHub star or a small donation keeps it going.",
      donationGithubBtn: "Star on GitHub",
      donationPaypalBtn: "Donate via PayPal",
      disclaimer: "Unofficial extension. Not affiliated with or endorsed by LumApps. Beekeeper and LumApps are trademarks of their respective owners.",
      errorPrefix: "Could not load settings:",
      noSettings: "This feature has no settings.",
      featureOffNotice: "This feature is off. You can still change its settings. They take effect once you turn it on.",
      aboutIntro: "Privacy, license and ways to support the project.",
      privacyTitle: "Privacy",
      privacyNote: "BeePlus has no servers of its own. No tracking, no analytics. Reminders and statistics stay on this device; settings and pinned chats sync through your Chrome profile if Chrome Sync is on. BeePlus only talks to Beekeeper, using your existing login.",
      privacyLink: "Read the privacy policy",
      aboutTitle: "About BeePlus",
      aboutVersion: "Version",
      aboutLicense: "License",
      aboutDeveloper: "Developer",
      aboutSource: "Source code",
      aboutBy: "BeePlus for Beekeeper by LUPZN",
      langLabel: "Language",
      langEn: "English",
      langDe: "Deutsch",
      addBtn: "Add",
      removeBtn: "Remove",
      savedStatus: "Saved.",

      // Feature names + descriptions
      featureProfileHover: "Profile Hover",
      featureProfileHoverDesc: "Hover over a profile picture to see the profile details you choose.",
      featureStickyPin: "Sticky Pinned Chats",
      featureStickyPinDesc: "Keep important chats pinned above your chat list.",
      featureQuickPolls: "Quick Polls",
      featureQuickPollsDesc: "Create numbered polls right from the message field.",
      featurePersonalStats: "Personal Stats",
      featurePersonalStatsDesc: "See your own activity at a glance. Stored locally, never sent anywhere.",
      featureReminderBot: "Reminder Bot",
      featureReminderBotDesc: "Right-click a message and get a reminder at the time you pick.",
      featureThemeEngine: "Theme Tweaks",
      featureThemeEngineDesc: "Compact layout, larger text, stronger focus outlines or your own CSS.",

      // Profile-Hover settings
      displaySection: "Display",
      showAvatarLabel: "Show profile picture",
      showAvatarDesc: "Shows the avatar at the top of the card.",
      hoverDelayLabel: "Hover delay",
      hoverDelayDesc: "How long the pointer rests on an avatar before the card appears.",
      fieldsSection: "Fields",
      fieldsHint: "Pick the fields the card should show. The list fills up once BeePlus has loaded a first profile. If it stays empty, hover over a profile picture in Beekeeper and reload this page.",
      addFieldPlaceholder: "Add a field key, e.g. custom.unterkunft",
      fieldsEmpty: "No fields known yet.",
      orderSection: "Order",
      orderHint: "Drag the entries or use the arrows. The card lists the fields from top to bottom.",
      orderEmpty: "Select fields above and they show up here.",
      moveUp: "Move up",
      moveDown: "Move down",

      // Tooltip messages
      tooltipLoading: "Loading profile...",
      tooltipEmpty: "No fields with values found.",

      // Sticky-Pin
      stickyPinHint: "In Beekeeper, hover over a chat and click the small pin at its top left.",
      pinnedChatsLabel: "Pinned chats",
      pinnedChatsDesc: "Pinned chats sit above your chat list in this order.",
      noPinnedChats: "No chats pinned yet.",
      chatIdLabel: "Chat ID",
      unpinBtn: "Unpin",
      pinBtnTitle: "Pin or unpin chat",

      // Theme
      themePresetLabel: "Preset",
      themePresetNone: "None (default)",
      themePresetCompact: "Compact",
      themePresetReading: "Reading (serif font)",
      themePresetLargerFont: "Larger text",
      themePresetFocusOutline: "Strong focus outline",
      themePresetMinimalReactions: "Hide reaction counts",
      themePresetCustom: "Custom CSS",
      themeNote: "Beekeeper has its own dark mode (Beekeeper settings → Theme). BeePlus only adjusts layout, font size and accessibility.",
      customCssPlaceholder: "/* Custom CSS for *.beekeeper.io */",
      applyThemeBtn: "Apply",
      themeSaved: "Theme saved. Open Beekeeper tabs update automatically.",
      themeSavedOff: "Theme saved. Turn on Theme Tweaks to apply it.",

      // Quick Polls
      howItWorks: "How it works",
      pollStep1: "Open a chat so the message field is visible.",
      pollStep2: "Click the round poll button in the bottom-right corner.",
      pollStep3: "Enter a question and one option per line, then insert the poll.",
      pollStep4: "Everyone votes by reacting with the number of their choice.",

      // Reminder Bot
      reminderHint: "Right-click a message in Beekeeper and pick when you want to be reminded.",
      activeRemindersLabel: "Upcoming reminders",
      noActiveReminders: "No reminders scheduled.",
      reminderNoText: "(no text)",
      cancelReminder: "Delete reminder",
      reminderSet: "Reminder set for {time}",
      reminderIn5m: "In 5 minutes",
      reminderIn30m: "In 30 minutes",
      reminderIn1h: "In 1 hour",
      reminderIn3h: "In 3 hours",
      reminderTomorrow: "Tomorrow morning",
      reminderCustom: "Custom...",
      reminderNotifTitle: "Beekeeper reminder",

      // Stats
      statsTodayLabel: "Today",
      statsWeekLabel: "Last 7 days",
      statsAllTimeLabel: "All time",
      statsMessagesSent: "Messages sent",
      statsReactionsGiven: "Reactions given",
      statsActiveDays: "Active days",
      statsPeakHour: "Peak hour",
      statsResetBtn: "Reset statistics",
      statsResetConfirm: "Reset all statistics? This can't be undone.",
      statsHourlyTitle: "Activity by hour",
      statsHourlySub: "Messages and reactions per hour, across all days",
      statsHourCol: "Hour",
      statsCountCol: "Activity",
      statsEmpty: "No activity yet. Send a message in Beekeeper and tracking starts.",
      statsResetDone: "Statistics reset.",

      // Debug
      debugSection: "Debug",
      debugHint: "Stored data for troubleshooting",
      clearCacheBtn: "Clear cache and known fields",
      cacheCleared: "Cache cleared."
    },

    de: {
      optionsHeading: "BeePlus für Beekeeper",
      brandSub: "für Beekeeper by LumApps",
      navLabel: "Einstellungen",
      navOverview: "Übersicht",
      navFeatures: "Funktionen",
      navMore: "Mehr",
      navAbout: "Info & Support",
      heroEyebrow: "BeePlus",
      heroTitle: "Mehr aus Beekeeper by LumApps herausholen",
      heroText: "Sechs Erweiterungen für die Beekeeper-Web-App. Jede lässt sich einzeln an- und ausschalten, ohne Einrichtung.",
      heroActive: "{n} von {total} aktiv",
      heroLocal: "Kein Tracking, keine eigenen Server",
      featuresSection: "Funktionen",
      featuresHint: "Karte öffnen, um die Einstellungen anzupassen.",
      statusOn: "Aktiv",
      statusOff: "Aus",
      settingsCta: "Einstellungen",
      settingsTitle: "Einstellungen",
      toggleAria: "{name} ein- oder ausschalten",
      toastEnabled: "{name} ist aktiv.",
      toastDisabled: "{name} ist aus.",
      toastReload: "Offene Beekeeper-Tabs werden neu geladen.",
      moreSoonTitle: "Mehr ist in Arbeit",
      moreSoonDesc: "Später senden, Reaktionen, Sprache zu Text und weitere Ideen stehen auf der Roadmap.",
      suggestFeature: "Funktion vorschlagen",
      supportTitle: "Kostenlos und Open Source",
      supportText: "BeePlus ist ein Nebenprojekt von LUPZN. Wenn es dir Zeit spart, hilft ein Stern auf GitHub oder eine kleine Spende, dass es weitergeht.",
      donationGithubBtn: "Stern auf GitHub",
      donationPaypalBtn: "Per PayPal spenden",
      disclaimer: "Inoffizielle Erweiterung. Nicht mit LumApps verbunden und nicht von LumApps unterstützt. Beekeeper und LumApps sind Marken ihrer jeweiligen Inhaber.",
      errorPrefix: "Einstellungen konnten nicht geladen werden:",
      noSettings: "Für diese Funktion gibt es keine Einstellungen.",
      featureOffNotice: "Diese Funktion ist ausgeschaltet. Du kannst die Einstellungen trotzdem anpassen. Sie greifen, sobald du die Funktion einschaltest.",
      aboutIntro: "Datenschutz, Lizenz und wie du das Projekt unterstützen kannst.",
      privacyTitle: "Datenschutz",
      privacyNote: "BeePlus hat keine eigenen Server. Kein Tracking, keine Analyse. Erinnerungen und Statistik bleiben auf diesem Gerät, Einstellungen und angepinnte Chats synchronisiert Chrome über dein Profil, wenn Chrome Sync aktiv ist. BeePlus spricht nur mit Beekeeper, über deine bestehende Anmeldung.",
      privacyLink: "Datenschutzerklärung lesen",
      aboutTitle: "Über BeePlus",
      aboutVersion: "Version",
      aboutLicense: "Lizenz",
      aboutDeveloper: "Entwickler",
      aboutSource: "Quellcode",
      aboutBy: "BeePlus für Beekeeper von LUPZN",
      langLabel: "Sprache",
      langEn: "English",
      langDe: "Deutsch",
      addBtn: "Hinzufügen",
      removeBtn: "Entfernen",
      savedStatus: "Gespeichert.",

      featureProfileHover: "Profil-Hover",
      featureProfileHoverDesc: "Mauszeiger auf ein Profilbild, und die Profilfelder deiner Wahl erscheinen sofort.",
      featureStickyPin: "Angepinnte Chats",
      featureStickyPinDesc: "Wichtige Chats bleiben fest über der Chatliste.",
      featureQuickPolls: "Schnell-Umfragen",
      featureQuickPollsDesc: "Nummerierte Umfragen direkt aus dem Nachrichtenfeld.",
      featurePersonalStats: "Persönliche Statistik",
      featurePersonalStatsDesc: "Deine eigene Aktivität auf einen Blick. Bleibt lokal und wird nie übertragen.",
      featureReminderBot: "Erinnerungs-Bot",
      featureReminderBotDesc: "Rechtsklick auf eine Nachricht, Zeitpunkt wählen, die Erinnerung kommt pünktlich.",
      featureThemeEngine: "Theme-Tweaks",
      featureThemeEngineDesc: "Kompaktes Layout, größere Schrift, deutlichere Fokus-Rahmen oder eigenes CSS.",

      displaySection: "Anzeige",
      showAvatarLabel: "Profilbild anzeigen",
      showAvatarDesc: "Zeigt das Profilbild oben in der Karte.",
      hoverDelayLabel: "Verzögerung",
      hoverDelayDesc: "Wie lange der Mauszeiger auf dem Profilbild ruhen muss, bis die Karte erscheint.",
      fieldsSection: "Felder",
      fieldsHint: "Wähle die Felder, die in der Karte stehen sollen. Die Liste füllt sich, sobald BeePlus ein erstes Profil geladen hat. Bleibt sie leer, in Beekeeper kurz über ein Profilbild fahren und diese Seite neu laden.",
      addFieldPlaceholder: "Feld-Schlüssel hinzufügen, z.B. custom.unterkunft",
      fieldsEmpty: "Noch keine Felder bekannt.",
      orderSection: "Reihenfolge",
      orderHint: "Einträge ziehen oder die Pfeile nutzen. Die Karte zeigt die Felder von oben nach unten.",
      orderEmpty: "Wähle oben Felder aus, dann erscheinen sie hier.",
      moveUp: "Nach oben",
      moveDown: "Nach unten",

      tooltipLoading: "Lade Profil...",
      tooltipEmpty: "Keine Felder mit Werten gefunden.",

      stickyPinHint: "In Beekeeper mit der Maus über einen Chat fahren und oben links auf die kleine Pinnadel klicken.",
      pinnedChatsLabel: "Angepinnte Chats",
      pinnedChatsDesc: "Angepinnte Chats stehen in dieser Reihenfolge über der Chatliste.",
      noPinnedChats: "Noch keine Chats angepinnt.",
      chatIdLabel: "Chat-ID",
      unpinBtn: "Lösen",
      pinBtnTitle: "Chat anpinnen oder lösen",

      themePresetLabel: "Vorlage",
      themePresetNone: "Keine (Standard)",
      themePresetCompact: "Kompakt",
      themePresetReading: "Lesemodus (Serifenschrift)",
      themePresetLargerFont: "Größere Schrift",
      themePresetFocusOutline: "Deutlicher Fokus-Rahmen",
      themePresetMinimalReactions: "Reaktionszähler ausblenden",
      themePresetCustom: "Eigenes CSS",
      themeNote: "Beekeeper hat einen eigenen Dark Mode (Beekeeper-Einstellungen → Theme). BeePlus passt nur Layout, Schriftgröße und Barrierefreiheit an.",
      customCssPlaceholder: "/* Eigenes CSS für *.beekeeper.io */",
      applyThemeBtn: "Übernehmen",
      themeSaved: "Theme gespeichert. Offene Beekeeper-Tabs passen sich automatisch an.",
      themeSavedOff: "Theme gespeichert. Schalte die Theme-Tweaks ein, damit es wirkt.",

      howItWorks: "So funktioniert's",
      pollStep1: "Einen Chat öffnen, sodass das Nachrichtenfeld sichtbar ist.",
      pollStep2: "Unten rechts auf den runden Umfrage-Button klicken.",
      pollStep3: "Frage und eine Option pro Zeile eintragen, dann die Umfrage einfügen.",
      pollStep4: "Abgestimmt wird per Reaktion mit der Zahl der gewünschten Option.",

      reminderHint: "In Beekeeper mit Rechtsklick auf eine Nachricht auswählen, wann du erinnert werden willst.",
      activeRemindersLabel: "Anstehende Erinnerungen",
      noActiveReminders: "Keine Erinnerungen geplant.",
      reminderNoText: "(kein Text)",
      cancelReminder: "Erinnerung löschen",
      reminderSet: "Erinnerung gesetzt für {time}",
      reminderIn5m: "In 5 Minuten",
      reminderIn30m: "In 30 Minuten",
      reminderIn1h: "In 1 Stunde",
      reminderIn3h: "In 3 Stunden",
      reminderTomorrow: "Morgen früh",
      reminderCustom: "Eigene Zeit...",
      reminderNotifTitle: "Beekeeper-Erinnerung",

      statsTodayLabel: "Heute",
      statsWeekLabel: "Letzte 7 Tage",
      statsAllTimeLabel: "Insgesamt",
      statsMessagesSent: "Nachrichten gesendet",
      statsReactionsGiven: "Reaktionen vergeben",
      statsActiveDays: "Aktive Tage",
      statsPeakHour: "Spitzenstunde",
      statsResetBtn: "Statistik zurücksetzen",
      statsResetConfirm: "Gesamte Statistik zurücksetzen? Das lässt sich nicht rückgängig machen.",
      statsHourlyTitle: "Aktivität nach Uhrzeit",
      statsHourlySub: "Nachrichten und Reaktionen pro Stunde, über alle Tage",
      statsHourCol: "Stunde",
      statsCountCol: "Aktivität",
      statsEmpty: "Noch keine Aktivität. Sobald du in Beekeeper schreibst, beginnt die Zählung.",
      statsResetDone: "Statistik zurückgesetzt.",

      debugSection: "Debug",
      debugHint: "Gespeicherte Daten zur Fehlersuche",
      clearCacheBtn: "Cache und bekannte Felder löschen",
      cacheCleared: "Cache gelöscht."
    }
  };

  function t(key) {
    // Return undefined when key is missing so callers can use their fallback
    return (DICT[currentLang] && DICT[currentLang][key]) || DICT.en[key] || undefined;
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
