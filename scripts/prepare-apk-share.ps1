$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$apkCandidates = @(
  (Join-Path $Root "public\downloads\TitanOS.apk"),
  (Join-Path $Root "TitanOS.apk"),
  (Join-Path $Root "android\app\build\outputs\apk\debug\app-debug.apk")
)
$apkSource = $apkCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$releaseDir = Join-Path $Root "release"
$stagingDir = Join-Path $releaseDir "apk-email-share"
$zipPath = Join-Path $releaseDir "TitanOS-EmailShare.zip"
$renamePath = Join-Path $releaseDir "TitanOS-Install.zip"

if (-not $apkSource) {
  Write-Error "APK not found. Run npm run android:build first."
}

$apkDest = Join-Path $Root "public\downloads\TitanOS.apk"
if ($apkSource -ne $apkDest) {
  New-Item -ItemType Directory -Force -Path (Split-Path $apkDest) | Out-Null
  Copy-Item $apkSource $apkDest -Force
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

$installText = @"
TitanOS Android install (email-safe package)
===========================================

Gmail blocks .apk attachments. This zip is safe to email.

On the Android phone:
1. Download and open this zip (or the TitanOS-Install.zip file).
2. Extract TitanOS.apk.bin
3. Rename TitanOS.apk.bin to TitanOS.apk
4. Open the .apk file and tap Install
5. If prompted, allow installs from unknown sources

Alternative: upload TitanOS.apk to Google Drive and share a link instead of emailing.

"@
$installText | Set-Content (Join-Path $stagingDir "INSTALL.txt") -Encoding UTF8
Copy-Item $apkSource (Join-Path $stagingDir "TitanOS.apk.bin") -Force
Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -Force
Remove-Item $stagingDir -Recurse -Force

# Gmail also blocks raw .apk; a .zip extension copy often passes as a generic archive.
Copy-Item $apkSource $renamePath -Force

Write-Host "Email-safe share files ready:"
Write-Host "  $zipPath"
Write-Host "  $renamePath (rename to .apk on the phone if using this file alone)"
