# Privacy Policy — Profile Hover for Beekeeper

_Last updated: 2026-04-26_

## Summary (TL;DR)

This extension does **not** collect, transmit, sell or share any personal data.
All processing happens locally in your browser. There are no analytics, no
tracking, no remote servers operated by the extension author.

## What the extension does

When the user hovers over a profile picture on a Beekeeper page
(`*.beekeeper.io`), the extension performs the following actions, all inside
the user's browser:

1. **Reads the user UUID** from the page's DOM (HTML attributes, `<a>` href, or
   from the avatar URL via an in-memory mapping built from API responses the
   Beekeeper SPA itself fetches).
2. **Calls the Beekeeper REST API endpoint `/api/2/profiles/{uuid}`** using the
   user's existing Beekeeper session cookie. The extension does NOT establish
   its own authentication. It can only access data that the logged-in user
   could already see by visiting the profile in Beekeeper directly.
3. **Caches the response in memory and in `chrome.storage.local`** so that
   repeated hovers don't trigger repeated API calls. Cache TTL: 5 minutes.
   Storage stays on the user's device only and is cleared when the extension
   is uninstalled, or via the Options page → Debug → "Clear cache" button.
4. **Renders the configured profile fields as a tooltip** next to the avatar.

## Data the extension stores locally

Stored in `chrome.storage.sync` (synced across the user's Chrome profile):

- `selectedFields` — list of profile field keys the user has chosen to show.
- `showAvatar` — boolean toggle.

Stored in `chrome.storage.local` (this device only):

- `knownFields` — list of profile field keys the extension has seen, used to
  populate the Options page checkboxes.
- `fieldLabels` — map of field key to human-readable label, taken from the
  Beekeeper API responses.

## Data the extension does NOT collect or transmit

- No data is sent to the extension author or any third party.
- No tracking cookies, no analytics, no telemetry.
- No background uploads, no remote logging.
- No account creation or external authentication.

## Network requests

The extension makes HTTP requests **only** to the Beekeeper tenant the user is
currently using (`https://*.beekeeper.io/api/2/profiles/...`). These are
same-origin requests using the user's existing session cookie.

The MAIN-world helper script (`page-script.js`) hooks `fetch`, `XMLHttpRequest`
and jQuery AJAX **inside the Beekeeper page** to capture the
`x-csrf-token` header value (required by Beekeeper's API for authenticated
calls) and to build an avatar-file-UUID → user-UUID mapping. None of this
information ever leaves the browser.

## Permissions the extension requests

- `storage` — to remember user settings, pinned chats, reminders and stats.
- `notifications` — to deliver reminder pop-ups when a snoozed message is due.
- `alarms` — to schedule reminder delivery; survives tab close + restart.
- Host permission `https://*.beekeeper.io/*` — to inject the content scripts
  on Beekeeper pages and to call the Beekeeper API on the user's behalf.

The extension does NOT request `cookies`, `webRequest`, `identity` or any
broader host permission. It does NOT request `tabs` permission — it uses
host-permission-scoped `chrome.tabs.query({url: "https://*.beekeeper.io/*"})`
to find Beekeeper tabs, which does not require the broader `tabs` permission.

## Beekeeper Terms of Service

This extension uses Beekeeper's internal SPA REST API via the user's existing
session. It is unaffiliated with and not endorsed by Beekeeper AG. Users are
responsible for ensuring their use of this extension complies with their
organization's Beekeeper subscription terms.

## Contact

Questions or concerns? Open an issue on the source repository or contact the
extension author at the email address listed in the Chrome Web Store entry.

## Changes to this policy

If the policy ever changes, the new version will be published here and in the
Chrome Web Store listing before the change becomes effective.
