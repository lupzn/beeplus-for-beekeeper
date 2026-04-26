# Screenshot workflow for Chrome Web Store

## Step 1 — Take raw screenshots

Drop your edited / cropped raw PNGs into `screenshots/raw/` with these
**exact filenames** (the `01-` / `02-` / ... prefix matters, the rest is free):

| File | What it should show |
|------|---------------------|
| `01-profile-hover.png` | Profile-Hover tooltip in action over a Beekeeper avatar |
| `02-quick-polls.png`   | Quick-Polls FAB or modal with a sample poll |
| `03-sticky-pin.png`    | Pinned chats at the top of inbox/streams list |
| `04-personal-stats.png`| Personal Stats summary (cards + chart) |
| `05-options.png`       | Options page overview with all feature cards |

The raw images can be **any size** — the script will scale and center them
on a 1280×800 branded canvas. Recommended: capture at high resolution so
scaling looks crisp.

## Step 2 — Build branded versions

```powershell
.\build-screenshots.ps1
# or double-click build-screenshots.bat
```

This wraps each raw screenshot in a 1280×800 LUPZN-branded canvas with:
- Indigo→purple gradient background
- Honey accent dot
- Title + subtitle (per file prefix, defined in the script)
- Drop shadow behind screenshot
- Footer: "made with love by **LUPZN** · beeplus-for-beekeeper"

Output → `screenshots/store/01-…png` … `05-…png`

Format: **1280×800, 24-bit PNG, no alpha** — meets Chrome Web Store spec.

## Step 3 — Upload

Chrome Web Store dashboard → your item → **Store listing** tab →
**Screenshots** section → drag&drop all 5 PNGs from `screenshots/store/`.

The store displays them in alphabetical order. Filenames are prefixed
`01-` through `05-` to match the intended display order.

## Editing captions

Edit `$captions` block in `build-screenshots.ps1`:

```ps1
$captions = @{
  '01' = @{ title = 'Profile Hover Tooltip'; sub = 'Hover any avatar...' }
  '02' = ...
}
```

Re-run the script to regenerate.

## Privacy

If you screenshot real Beekeeper data, anonymize first (blur names/avatars
in your image editor) before placing into `screenshots/raw/`. The script
does not anonymize automatically.

Better: use the standalone HTML mockups under `screenshots/mocks/` (open in
Chrome at 1280×800, take screenshot, crop, drop into `screenshots/raw/`).
