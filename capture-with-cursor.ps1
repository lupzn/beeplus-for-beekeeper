#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Capture a full-screen screenshot WITH the mouse cursor visible.

.DESCRIPTION
  Windows' built-in tools (PrintScreen, Snipping Tool) hide the cursor.
  This script grabs the screen via GDI and overlays the cursor manually.

  Output: screenshots/raw/cursor-capture-YYYYMMDD-HHMMSS.png

.EXAMPLE
  .\capture-with-cursor.ps1
  Counts down 5 seconds (so you can position your mouse), then captures.

  .\capture-with-cursor.ps1 -Delay 10
  Wait 10 seconds before capture.
#>

param(
  [int]$Delay = 5
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Win32 API for cursor info
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)]
  public struct CURSORINFO {
    public int cbSize;
    public int flags;
    public IntPtr hCursor;
    public POINT ptScreenPos;
  }
  [DllImport("user32.dll")]
  public static extern bool GetCursorInfo(out CURSORINFO pci);
  [DllImport("user32.dll")]
  public static extern IntPtr CopyIcon(IntPtr hIcon);
  [StructLayout(LayoutKind.Sequential)]
  public struct ICONINFO {
    public bool fIcon;
    public int xHotspot;
    public int yHotspot;
    public IntPtr hbmMask;
    public IntPtr hbmColor;
  }
  [DllImport("user32.dll")]
  public static extern bool GetIconInfo(IntPtr hIcon, out ICONINFO piconinfo);
  public const int CURSOR_SHOWING = 0x00000001;
}
"@

$outDir = Join-Path $PWD 'screenshots\raw'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Countdown
for ($i = $Delay; $i -gt 0; $i--) {
  Write-Host "Capturing in $i second(s)..." -ForegroundColor Yellow
  Start-Sleep -Seconds 1
}

# Bounds of all screens (multi-monitor support)
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)

# Get cursor info + draw it
$ci = New-Object Win32+CURSORINFO
$ci.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($ci)
if ([Win32]::GetCursorInfo([ref]$ci)) {
  if ($ci.flags -eq [Win32]::CURSOR_SHOWING) {
    $hicon = [Win32]::CopyIcon($ci.hCursor)
    $iconInfo = New-Object Win32+ICONINFO
    if ([Win32]::GetIconInfo($hicon, [ref]$iconInfo)) {
      $cursorIcon = [System.Drawing.Icon]::FromHandle($hicon)
      $x = $ci.ptScreenPos.X - $bounds.X - $iconInfo.xHotspot
      $y = $ci.ptScreenPos.Y - $bounds.Y - $iconInfo.yHotspot
      $g.DrawIcon($cursorIcon, $x, $y)
    }
  }
}

$g.Dispose()

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $outDir "cursor-capture-$ts.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host ""
Write-Host "Saved: $out" -ForegroundColor Green
Write-Host "Size:  $((Get-Item $out).Length / 1KB) KB" -ForegroundColor Gray
