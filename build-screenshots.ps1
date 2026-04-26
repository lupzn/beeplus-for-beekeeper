#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Builds Chrome-Web-Store-ready screenshots (1280x800, 24-bit PNG, no alpha).

.DESCRIPTION
  Drop your raw screenshots into screenshots/raw/ with these filenames:
    01-profile-hover.png   - Profile-Hover tooltip in action
    02-quick-polls.png     - Quick-Polls FAB or modal
    03-sticky-pin.png      - Pinned chats at top of inbox
    04-personal-stats.png  - Personal Stats cards + chart
    05-options.png         - Options page overview
  (Filenames must start with 01-/02-/.../05- for caption matching.)

  Run this script. Output goes to screenshots/store/ wrapped in BeePlus
  branded canvas (dark gradient bg, title, subtitle, LUPZN footer).
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$rawDir   = Join-Path $PWD 'screenshots\raw'
$outDir   = Join-Path $PWD 'screenshots\store'
$canvasW  = 1280
$canvasH  = 800

if (-not (Test-Path $rawDir)) {
  New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
  Write-Warning "Created $rawDir - drop your raw screenshots there and re-run."
  exit 0
}
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Captions per filename prefix (matches Chrome Web Store screenshot order)
$captions = @{
  '01' = @{ title = 'Profile Hover Tooltip';      sub = 'Hover any avatar to see configurable profile fields instantly.' }
  '02' = @{ title = 'Quick Polls';                sub = 'Numbered-emoji polls inserted directly into the composer.' }
  '03' = @{ title = 'Sticky Pinned Chats';        sub = 'Keep important chats at the top, regardless of activity.' }
  '04' = @{ title = 'Personal Stats';             sub = 'Track your activity locally - never transmitted.' }
  '05' = @{ title = 'Modular Feature Toggles';    sub = 'Enable only what you need. Each feature is independent.' }
}

$rawFiles = Get-ChildItem -Path $rawDir -Filter '*.png' | Sort-Object Name
if ($rawFiles.Count -eq 0) {
  Write-Warning "No PNGs found in $rawDir"
  Write-Host ""
  Write-Host "Drop your raw screenshots there with these filenames:" -ForegroundColor Yellow
  $captions.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host "  $($_.Key)-<anything>.png  ->  $($_.Value.title)" -ForegroundColor Gray
  }
  exit 0
}

foreach ($file in $rawFiles) {
  $prefix = $file.BaseName.Substring(0, 2)
  $cap = $captions[$prefix]
  if (-not $cap) { $cap = @{ title = 'BeePlus for Beekeeper'; sub = '' } }

  $canvas = New-Object System.Drawing.Bitmap($canvasW, $canvasH, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.TextRenderingHint = 'AntiAliasGridFit'

  # Brand gradient: indigo -> purple -> blue (matches BeePlus icon)
  $bgRect = New-Object System.Drawing.Rectangle(0, 0, $canvasW, $canvasH)
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(30, 27, 75),    # deep indigo
    [System.Drawing.Color]::FromArgb(76, 29, 149),   # rich purple
    135
  )
  $g.FillRectangle($bgBrush, $bgRect)

  # Subtle accent shapes
  $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 168, 85, 247))
  $g.FillEllipse($accentBrush, -200, -200, 600, 600)
  $g.FillEllipse($accentBrush, ($canvasW - 400), ($canvasH - 400), 600, 600)

  # Honey accent dot (BeePlus signature)
  $honeyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 251, 191, 36))
  $g.FillEllipse($honeyBrush, ($canvasW - 220), 80, 180, 180)

  # Title
  $titleFont = New-Object System.Drawing.Font('Segoe UI', 36, [System.Drawing.FontStyle]::Bold)
  $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.DrawString($cap.title, $titleFont, $titleBrush, [float]60, [float]50)

  # Subtitle
  if ($cap.sub) {
    $subFont = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Regular)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(190, 200, 220))
    $g.DrawString($cap.sub, $subFont, $subBrush, [float]60, [float]110)
  }

  # Load + place the screenshot, scaled to fit
  $img = [System.Drawing.Image]::FromFile($file.FullName)
  try {
    $maxImgW = $canvasW - 120          # 60px padding both sides
    $maxImgH = $canvasH - 240          # space for title + footer

    $scale = [Math]::Min($maxImgW / $img.Width, $maxImgH / $img.Height)
    if ($scale -gt 1) { $scale = 1 }   # never upscale beyond native
    $newW = [int]($img.Width * $scale)
    $newH = [int]($img.Height * $scale)
    $x = [int](($canvasW - $newW) / 2)
    $y = 180

    # Drop shadow behind screenshot
    $shadowRect = New-Object System.Drawing.Rectangle(($x - 8), ($y - 8), ($newW + 16), ($newH + 16))
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
    $g.FillRectangle($shadowBrush, $shadowRect)

    $g.DrawImage($img, $x, $y, $newW, $newH)
  } finally {
    $img.Dispose()
  }

  # Footer brand bar
  $footerY = $canvasH - 50
  $footerFont = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Regular)
  $footerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(170, 180, 200))
  $g.DrawString('made with love by', $footerFont, $footerBrush, [float]60, [float]$footerY)

  $brandFont = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
  $brandBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, $footerY, 200, 40)),
    [System.Drawing.Color]::FromArgb(96, 165, 250),
    [System.Drawing.Color]::FromArgb(192, 132, 252),
    0
  )
  $g.DrawString('LUPZN', $brandFont, $brandBrush, [float]220, [float]($footerY - 3))

  $g.DrawString('beeplus-for-beekeeper', $footerFont, $footerBrush, [float]($canvasW - 280), [float]$footerY)

  $g.Dispose()

  # Save as 24-bit PNG (no alpha) - meets Chrome Store spec
  $outPath = Join-Path $outDir ($file.BaseName + '.png')
  $canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()

  $size = [math]::Round((Get-Item $outPath).Length / 1KB, 1)
  Write-Host "  + $($file.Name) -> screenshots/store/$($file.BaseName).png  ($size KB)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Upload PNGs from:" -ForegroundColor Cyan
Write-Host "  $outDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Chrome Web Store specs met:" -ForegroundColor Gray
Write-Host "  - 1280x800" -ForegroundColor Gray
Write-Host "  - 24-bit PNG (no alpha)" -ForegroundColor Gray
Write-Host "  - Files named in upload order (01- to 05-)" -ForegroundColor Gray
