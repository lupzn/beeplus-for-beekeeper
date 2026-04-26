# Privacy Policy — BeePlus for Beekeeper

_Last updated: 2026-04-26_

## Summary (TL;DR)

BeePlus does **not** collect, transmit, sell or share any personal data.
All processing happens locally inside your browser. No analytics, no
tracking, no remote servers operated by the extension author. The extension
uses your existing Beekeeper login session — it does not establish its own
authentication.

## What the extension does

BeePlus is a modular suite of productivity add-ons for the Beekeeper
workplace messaging app. Each feature can be toggled on/off independently:

1. **Profile Hover Tooltip** — When you hover over a profile picture on a
   Beekeeper page, the extension reads the user's UUID from the page DOM
   (HTML attributes, `<a>` href) and calls the Beekeeper REST API endpoint
   `/api/2/profiles/{uuid}` using your existing session cookie. The response
   is cached in `chrome.storage.local` for 5 minutes to avoid repeat fetches.
2. **Sticky Pinned Chats** — Pin chat IDs are stored in `chrome.storage.sync`.
   The extension applies CSS to keep pinned chats at the top of the chat list.
3. **Quick Polls** — A floating button appears next to your composer. Clicking
   it opens a modal where you build a numbered-emoji poll; the formatted
   text is inserted into the composer's input field.
4. **Personal Stats** — Local-only counters increment when you send messages
   or react in Beekeeper. Aggregated to Today / Week / All-Time cards on the
   options page. Data lives in `chrome.storage.local`.
5. **Reminder Bot** — Right-clicking a message opens a snooze menu. The
   reminder is scheduled via `chrome.alarms` and delivered via
   `chrome.notifications` at the chosen time.
6. **Theme Tweaks** — Injects CSS into Beekeeper pages (compact layout,
   larger font, accessibility outlines, custom CSS).

The extension can only access data that you, the logged-in Beekeeper user,
could already see by visiting Beekeeper directly.

## Data the extension stores locally

Stored in `chrome.storage.sync` (synced across your Chrome profiles):

- `feature.<id>.enabled` — which features are on/off
- `feature.profileHover` — selected fields, hover delay, show-avatar toggle
- `feature.stickyPin.pinnedIds` — list of chat UUIDs you have pinned
- `feature.themeEngine` — chosen theme preset and custom CSS
- `bkpr.language` — UI language preference (en/de)

Stored in `chrome.storage.local` (this device only):

- Profile cache from the hover feature (cleared after 5 minutes per profile)
- `knownFields` — list of profile field keys the extension has seen, used to
  populate the options-page checkboxes
- `fieldLabels` — map of field key to human-readable label
- `stats.daily` — your local activity counters per day (messages, reactions,
  hourly buckets) — never transmitted
- `reminders.list` — your scheduled reminders (message snippet + due time)

All `chrome.storage.local` data is wiped when you uninstall the extension or
when you click "Clear cache + known fields" in the options page debug section.

## Data the extension does NOT collect or transmit

- No data is sent to the extension author or any third party
- No tracking cookies, no analytics, no telemetry
- No background uploads, no remote logging
- No account creation or external authentication
- No reading of other browser tabs, browsing history, bookmarks, or cookies
- The `bkpr-csrf-token` captured from Beekeeper API requests stays in
  memory inside the page only — never transmitted outside the browser

## Network requests

The extension makes HTTP requests **only** to the Beekeeper tenant you are
currently using (`https://*.beekeeper.io/api/...`). These are same-origin
requests using your existing session cookie.

The MAIN-world helper script (`page-script.js`) hooks `fetch`,
`XMLHttpRequest` and jQuery AJAX **inside the Beekeeper page** to:
- capture the `x-csrf-token` header value (required by Beekeeper's API for
  authenticated calls), and
- build an in-memory avatar-file-UUID → user-UUID mapping from API
  responses Beekeeper itself fetches.

None of this information ever leaves your browser.

## Permissions the extension requests

- `storage` — persist user settings, pinned chats, reminders, and stats.
- `notifications` — deliver desktop notifications for snoozed reminders.
- `alarms` — schedule reminder delivery; survives browser restart.
- `scripting` — re-inject content scripts into open Beekeeper tabs after
  the extension is updated, so users do not have to manually refresh.
- Host permission `https://*.beekeeper.io/*` — inject the BeePlus UI on
  Beekeeper pages and call the Beekeeper REST API on the user's behalf.

The extension does NOT request `cookies`, `webRequest`, `identity`, `tabs`,
`activeTab`, `history`, `bookmarks`, or any broader host permission.

## Beekeeper Terms of Service

This extension uses Beekeeper's internal SPA REST API via your existing
session cookie. It is unaffiliated with and not endorsed by Beekeeper AG.
Users are responsible for ensuring their use of this extension complies with
their organization's Beekeeper subscription terms.

## Contact

Questions or concerns? Open an issue on the source repository:

https://github.com/lupzn/beeplus-for-beekeeper/issues

## Changes to this policy

If the policy ever changes, the new version will be published here and in
the Chrome Web Store listing before the change becomes effective.
