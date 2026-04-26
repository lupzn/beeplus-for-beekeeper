#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Generates Chrome Web Store promotional tiles for BeePlus.

.DESCRIPTION
  Creates:
    screenshots/store/promo-small.png    (440x280 - Kleine Werbekachel)
    screenshots/store/promo-marquee.png  (1400x560 - Marquee-Werbekachel)

  Fully generated, no input files needed. 24-bit PNG, no alpha.

  Run: .\build-promo.ps1
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PWD 'screenshots\store'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-PromoTile {
  param(
    [int]$Width,
    [int]$Height,
    [string]$OutputPath,
    [int]$LogoSize,
    [int]$TitleSize,
    [int]$SubSize,
    [int]$TagSize,
    [bool]$Marquee = $false
  )

  $canvas = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.TextRenderingHint = 'AntiAliasGridFit'

  # BeePlus brand gradient: deep indigo -> rich purple
  $bgRect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(30, 27, 75),
    [System.Drawing.Color]::FromArgb(76, 29, 149),
    135
  )
  $g.FillRectangle($bgBrush, $bgRect)

  # Decorative purple accent circles
  $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 168, 85, 247))
  $r1 = [int]($Width * 0.5)
  $g.FillEllipse($accentBrush, -[int]($r1 * 0.4), -[int]($r1 * 0.4), $r1, $r1)
  $g.FillEllipse($accentBrush, $Width - [int]($r1 * 0.6), $Height - [int]($r1 * 0.6), $r1, $r1)

  # Honey accent dot (BeePlus signature)
  $honeyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45, 251, 191, 36))
  $hr = [int]($Width * 0.18)
  $g.FillEllipse($honeyBrush, $Width - $hr - 20, 20, $hr, $hr)

  # B+ logo (rounded square with gradient + hexagon outline)
  $logoX = [int]($Width * 0.05)
  $logoY = [int](($Height - $LogoSize) / 2)
  $logoRect = New-Object System.Drawing.Rectangle($logoX, $logoY, $LogoSize, $LogoSize)
  $logoBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $logoRect,
    [System.Drawing.Color]::FromArgb(37, 99, 235),
    [System.Drawing.Color]::FromArgb(168, 85, 247),
    135
  )
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $radius = [int]($LogoSize * 0.18)
  $d = $radius * 2
  $path.AddArc($logoX, $logoY, $d, $d, 180, 90)
  $path.AddArc($logoX + $LogoSize - $d, $logoY, $d, $d, 270, 90)
  $path.AddArc($logoX + $LogoSize - $d, $logoY + $LogoSize - $d, $d, $d, 0, 90)
  $path.AddArc($logoX, $logoY + $LogoSize - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.FillPath($logoBrush, $path)

  # Honey hexagon inside logo
  $hexCx = $logoX + $LogoSize / 2
  $hexCy = $logoY + $LogoSize / 2
  $hexR = $LogoSize * 0.32
  $hexPts = @()
  for ($i = 0; $i -lt 6; $i++) {
    $a = [Math]::PI / 3 * $i - [Math]::PI / 2
    $hexPts += New-Object System.Drawing.PointF([float]($hexCx + $hexR * [Math]::Cos($a)), [float]($hexCy + $hexR * [Math]::Sin($a)))
  }
  $hexPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 251, 191, 36), [float]($LogoSize * 0.04))
  $g.DrawPolygon($hexPen, $hexPts)

  # "B+" text inside hexagon
  $bpFontSize = if ($LogoSize -ge 100) { [float]($LogoSize * 0.42) } else { [float]($LogoSize * 0.48) }
  $bpText = if ($LogoSize -ge 100) { "B+" } else { "B" }
  $bpFont = New-Object System.Drawing.Font('Segoe UI', $bpFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $bpBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $fmt.LineAlignment = 'Center'
  $g.DrawString($bpText, $bpFont, $bpBrush, [float]$hexCx, [float]($hexCy - $LogoSize * 0.02), $fmt)

  # Text block right of logo
  $textX = $logoX + $LogoSize + [int]($Width * 0.04)

  # Title — "BeePlus" big, "for Beekeeper" smaller
  $titleFont = New-Object System.Drawing.Font('Segoe UI', [float]$TitleSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $titleY = [int]($Height * 0.18)
  $g.DrawString('BeePlus', $titleFont, $titleBrush, [float]$textX, [float]$titleY)

  $forFont = New-Object System.Drawing.Font('Segoe UI', [float]($TitleSize * 0.55), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $forBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 210, 230))
  $g.DrawString('for Beekeeper', $forFont, $forBrush, [float]$textX, [float]($titleY + $TitleSize * 1.05))

  # Tagline (gradient accent)
  $subFont = New-Object System.Drawing.Font('Segoe UI', [float]$SubSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $subRectH = [int]($SubSize * 2)
  $subRect = New-Object System.Drawing.Rectangle($textX, 0, [int]($Width * 0.6), $subRectH)
  $subBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $subRect,
    [System.Drawing.Color]::FromArgb(96, 165, 250),
    [System.Drawing.Color]::FromArgb(192, 132, 252),
    0
  )
  $subY = [int]($titleY + $TitleSize * 2.3)
  $g.DrawString('Productivity add-ons for Beekeeper', $subFont, $subBrush, [float]$textX, [float]$subY)

  # Tag line at bottom
  $tagFont = New-Object System.Drawing.Font('Segoe UI', [float]$TagSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(170, 180, 200))
  if ($Marquee) {
    $g.DrawString('Profile hover  -  Pinned chats  -  Polls  -  Reminders  -  Stats  -  No tracking', $tagFont, $tagBrush, [float]$textX, [float]($subY + $SubSize * 1.8))
  } else {
    $g.DrawString('6 features - No tracking', $tagFont, $tagBrush, [float]$textX, [float]($subY + $SubSize * 1.8))
  }

  # LUPZN brand bottom-right
  $brandFont = New-Object System.Drawing.Font('Segoe UI', [float]($TagSize * 0.95), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $brandBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(($Width - 120), ($Height - 30), 100, 20)),
    [System.Drawing.Color]::FromArgb(96, 165, 250),
    [System.Drawing.Color]::FromArgb(192, 132, 252),
    0
  )
  $sz = $g.MeasureString('LUPZN', $brandFont)
  $g.DrawString('LUPZN', $brandFont, $brandBrush, [float]($Width - $sz.Width - 16), [float]($Height - $sz.Height - 10))

  $g.Dispose()
  $canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  $size = [math]::Round((Get-Item $OutputPath).Length / 1KB, 1)
  Write-Host "  + $OutputPath  ($size KB)" -ForegroundColor Green
}

# Small tile: 440x280 (Kleine Werbekachel)
New-PromoTile -Width 440 -Height 280 -OutputPath (Join-Path $outDir 'promo-small.png') `
  -LogoSize 140 -TitleSize 32 -SubSize 14 -TagSize 11 -Marquee $false

# Marquee tile: 1400x560 (Laufschrift-Werbekachel)
New-PromoTile -Width 1400 -Height 560 -OutputPath (Join-Path $outDir 'promo-marquee.png') `
  -LogoSize 340 -TitleSize 86 -SubSize 36 -TagSize 22 -Marquee $true

Write-Host ""
Write-Host "Done. Upload from:" -ForegroundColor Cyan
Write-Host "  $outDir" -ForegroundColor Yellow
Write-Host "  - promo-small.png    -> Kleine Werbekachel (440x280)" -ForegroundColor Gray
Write-Host "  - promo-marquee.png  -> Laufschrift-Werbekachel (1400x560)" -ForegroundColor Gray
