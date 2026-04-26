# How to take Chrome Web Store screenshots

5 mockup HTML pages in `screenshots/mocks/`. All fake data — no real Beekeeper info.

## Required size

**1280 × 800 PNG** for Chrome Web Store (max 5 screenshots).

## Quickest path (Chrome built-in)

1. Open one of the `mocks/*.html` files in Chrome
2. F12 → toggle device toolbar (Ctrl+Shift+M)
3. Set responsive size to **1280 × 800**
4. Click the `⋯` menu in DevTools toolbar → **Capture screenshot**
5. Save PNG into `screenshots/store/` (create folder if missing)

Repeat for each `mocks/*.html`.

## Recommended order for upload

| # | File | What it shows |
|---|------|---------------|
| 1 | `01-profile-hover.html` | Profile-Hover tooltip in chat feed |
| 2 | `03-sticky-pin.html` | Pinned chats at top of Inbox |
| 3 | `02-quick-polls.html` | Quick-Poll FAB + modal with preview |
| 4 | `04-stats.html` | Personal Stats summary cards + chart |
| 5 | `05-options-overview.html` | Full options page with all 7 features |

## Alternative: PowerShell + headless Chrome

```powershell
# Auto-screenshot all mocks at 1280x800 via headless Chrome
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = "screenshots\store"
New-Item -ItemType Directory -Force -Path $out | Out-Null

Get-ChildItem screenshots\mocks\*.html | ForEach-Object {
  $url = "file:///$($_.FullName -replace '\\','/')"
  $png = Join-Path $out "$($_.BaseName).png"
  & $chrome --headless --disable-gpu --hide-scrollbars `
    --window-size=1280,800 --screenshot=$png $url
  Write-Host "  + $png"
}
```

Save as `build-screenshots.ps1`, run from extension root.

## Editing mockups

- **Avatars**: `https://i.pravatar.cc/100?img=NN` (1-70). Replace `NN` for different faces.
- **Names/text**: edit HTML directly. All English by default.
- **Branding**: change `Acme Logistics` to your own demo company name.

## Privacy

These mockups use:
- Fake names (Sarah Chen, Marcus Weber, etc.)
- Random pravatar.cc avatars (open-source placeholder service)
- Fake company "Acme Logistics"
- Plausible but invented chat content

Nothing from your real Beekeeper tenant is included.
