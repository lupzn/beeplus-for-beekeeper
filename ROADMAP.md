# BeePlus — Feature Roadmap

BeePlus is a modular productivity suite for [Beekeeper](https://www.beekeeper.io).
Each feature is an independent, toggleable module under `features/<id>/`.
Users can enable / disable / configure each feature individually.

## Architecture (already built)

```
beekeeper-extension/
├── manifest.json
├── content.js                        ← entry: bootstraps registry + initAll
├── page-script.js                    ← MAIN-world: CSRF capture, avatar→user map
├── core/
│   ├── registry.js                   ← runtime FeatureRegistry
│   ├── options-registry.js           ← options-page registry
│   └── bkpr-api.js                   ← shared Beekeeper API helpers (cached)
├── features/
│   └── profile-hover/
│       ├── index.js                  ← feature runtime (init + teardown)
│       └── options-ui.js             ← settings UI in options page
├── options.html / options.js / options.css
├── background.js                     ← seeds defaults, opens options
└── styles.css                        ← tooltip + injected UI styles
```

A feature module:

```js
window.BeePlus.FeatureRegistry.register({
  id: "my-feature",
  name: "myFeatureI18nKey",
  description: "myFeatureDescI18nKey",
  defaultEnabled: true,
  init:     async (ctx) => { /* attach listeners, mount UI, etc. */ },
  teardown: async ()    => { /* remove everything cleanly */ }
});
```

## Shipped — v1.1

### `profile-hover` ✅
Hover an avatar → tooltip with configurable profile fields. Custom fields
auto-discovered from API. Drag-and-drop ordering. Light + dark theme.

### `sticky-pin` ✅
Pin chats to keep them at the top of the chat list, regardless of activity.
Hover a chat row → click pin icon. Storage: `chrome.storage.sync` (synced
across user's Chrome profiles).

### `theme-engine` ✅
Inject custom CSS into Beekeeper. Built-in presets (OLED Black, High Contrast,
Solarized, Compact) plus user-defined custom CSS textarea.

### `quick-polls` ✅
Adds a 📊 button next to the message composer. Opens a modal where the user
defines a question + options; the extension formats the result with numbered
emojis and inserts it into the composer. Recipients vote by reacting with the
corresponding emoji.

### `export` ✅
Download own profile + all accessible team profiles as JSON or CSV. Pure
local — runs from inside the Beekeeper tab via `chrome.tabs.sendMessage`,
nothing leaves the browser. CSV flattens custom-fields automatically.

### `reminder-bot` ✅
Right-click on any message → snooze menu (5min / 30min / 1h / 3h / tomorrow /
custom). Stored in `chrome.storage.local`, scheduled via `chrome.alarms`,
delivered as native `chrome.notifications`. Survives tab close + browser
restart. Click notification → opens Beekeeper.

### `personal-stats` ✅
Per-day local counters for messages-sent and reactions-given. Aggregated to
Today / Week / All-Time cards in options page. Tracks peak active hour. All
data in `chrome.storage.local`, never transmitted.

## Planned features (priority order)

### `quick-reply-snippets` (v1.2)
Saved text snippets (templates) that can be inserted into Beekeeper's
message composer with a slash-command (`/<keyword>`) or a popup picker.
- Storage: `feature.quickReplySnippets.snippets = [{shortcut, text}]`
- DOM: detect Beekeeper composer textarea, intercept input

### `mention-search-plus` (v1.2)
Better @mention picker — fuzzy search across all users (not just current
chat members), shows avatar + role + custom fields directly in dropdown.
- API: `/api/2/profiles/search?q=...`
- Replaces native @-popup with enhanced one

### `auto-translate` (v1.2)
Inline-translate any chat message to user's preferred language.
- DeepL or Google Translate (user provides API key in options)
- Per-user toggle (always-translate, on-demand)

### `notifications-plus` (v1.2)
Native desktop notifications for chats with custom filters
(only certain users / streams / keywords). Respects DND.
- `notifications` permission needed
- Pulls from Beekeeper's WebSocket / poll endpoint

### `read-later` (v1.3)
Bookmark messages to a personal "read later" list. Optional reminder.
- Local-only, no Beekeeper-API write needed

### `keyboard-shortcuts` (v1.3)
Configurable hotkeys: jump to next unread, mark all read, quick-switcher
across chats/streams.
- `commands` API in manifest

### `profile-export` (v1.4)
Export team-member profile data to CSV / vCard / Outlook contacts.
For HR / admin users only — uses existing session + admin permissions.

### `birthday-reminders` (v1.4)
Local calendar of team birthdays based on `custom.birthdate`.
Toast on the day, optional reminder N days before.

### `dark-mode-plus` (v1.5)
Polished dark-mode override with extra accents (Beekeeper has dark mode but
some elements still light). User CSS injection.

### `org-chart` (v2.0)
Builds an org chart from `custom.reports_to` chains. Full team-tree view
in a dedicated panel. Click a node to open the profile.

### `chat-search-plus` (v2.0)
Cross-stream search over all chats with date / sender / attachment filters.
Native search is limited per-stream.

## Cross-cutting concerns

### Settings sync
All feature settings under `chrome.storage.sync` keyed `feature.<id>` so
they sync across the user's signed-in Chrome profiles.

### Internationalization
Every user-facing string must use a `chrome.i18n.getMessage("...")` key
defined in `_locales/{en,de}/messages.json`. Add new locales: `fr`, `es`,
`it`, `pt`, `nl` as user demand grows.

### Keyboard accessibility
Tooltip + popups must be reachable via keyboard. Use `tabindex`, ARIA roles.

### Performance
Features should defer heavy work until they're actually needed. Use
`requestIdleCallback` for periodic scans. Avoid global MutationObservers
unless absolutely necessary; prefer event-delegation on `document`.

### Beekeeper API stability
Beekeeper's internal API can change. All API calls go through
`window.BeePlus.api.*` (in `core/bkpr-api.js`). When Beekeeper changes a
shape, fix it once there — every feature picks it up.

## Adding a new feature — checklist

1. Create `features/<my-feature>/index.js` — runtime module.
2. Create `features/<my-feature>/options-ui.js` — settings UI.
3. Register both modules in `manifest.json` `content_scripts.js` and
   `options.html` `<script>` tags.
4. Add i18n keys in `_locales/en/messages.json` and `_locales/de/messages.json`.
5. Add default to `background.js` `chrome.runtime.onInstalled`.
6. Update `ROADMAP.md` (this file) — move from "Planned" to "Shipped".
7. Bump `version` in `manifest.json`.
8. Re-publish to Chrome Web Store.

## Out of scope (deliberately)

- Server-side / multi-user collaboration features (extension is per-user only)
- Anything that writes data to Beekeeper without a user-initiated action
  (security + ToS)
- Replacing Beekeeper's core chat experience — BeePlus enhances, doesn't replace
