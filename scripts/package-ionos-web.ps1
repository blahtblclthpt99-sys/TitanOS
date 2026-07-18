$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Building TitanOS website for IONOS (base=/ )..."
Remove-Item Env:VITE_CAPACITOR_BUILD -ErrorAction SilentlyContinue
$env:NODE_OPTIONS = "--use-system-ca"
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$releaseDir = Join-Path $Root "release"
$staging = Join-Path $releaseDir "ionos-web"
$zipPath = Join-Path $releaseDir "TitanOS-IONOS-Web.zip"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Copy-Item -Path (Join-Path $Root "dist\*") -Destination $staging -Recurse -Force

# Ensure SPA rewrite files are present
Copy-Item (Join-Path $Root "public\.htaccess") (Join-Path $staging ".htaccess") -Force
Copy-Item (Join-Path $Root "public\web.config") (Join-Path $staging "web.config") -Force

# Live IONOS download page expects /static/TitanOS.apk and /static/TitanOS.aab
$staticDir = Join-Path $staging "static"
New-Item -ItemType Directory -Force -Path $staticDir | Out-Null
$downloadsDir = Join-Path $staging "downloads"
New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null

$apkCandidates = @(
  (Join-Path $Root "public\downloads\TitanOS.apk"),
  (Join-Path $Root "release\TitanOS.apk"),
  (Join-Path $staging "downloads\TitanOS.apk")
) | Where-Object { Test-Path $_ }
$aabCandidates = @(
  (Join-Path $Root "release\TitanOS.aab")
) | Where-Object { Test-Path $_ }

if ($apkCandidates.Count -gt 0) {
  $apk = $apkCandidates[0]
  Copy-Item $apk (Join-Path $staticDir "TitanOS.apk") -Force
  Copy-Item $apk (Join-Path $downloadsDir "TitanOS.apk") -Force
  Write-Host "Packed APK from $apk"
} else {
  Write-Warning "TitanOS.apk not found — download buttons will 404 until you add it."
}

if ($aabCandidates.Count -gt 0) {
  $aab = $aabCandidates[0]
  Copy-Item $aab (Join-Path $staticDir "TitanOS.aab") -Force
  Write-Host "Packed AAB from $aab"
}

@"
TitanOS — IONOS website upload
==============================

WHY THE LIVE SITE FEELS BROKEN
- "Get Started Free" only opened Download — no signup existed.
- Beta form talked to localhost PocketBase (dead on IONOS).
- This package is the FULL TitanOS product with the same dark marketing layout.

UPLOAD STEPS
1. Unzip TitanOS-IONOS-Web.zip on your PC.
2. In IONOS File Manager / FTP open the web root (/ or /httpdocs).
3. DELETE old site files first: index.html, assets/, and any old JS/CSS.
   Keep /static/ only if you already have working APK/AAB there — or replace it.
4. Upload EVERYTHING from this zip into the web root:
   - index.html
   - .htaccess   (required for /login /register /download routes)
   - web.config
   - assets/
   - static/TitanOS.apk + static/TitanOS.aab
   - downloads/TitanOS.apk
   - favicon.svg
5. Hard-refresh https://YOUR-DOMAIN/ (Ctrl+F5).

WHAT EACH BUTTON DOES NOW
- Get Started Free  -> /register (create real account)
- Sign in           -> /login
- Download / Get App -> /download (real APK + AAB files)
- Beta Program      -> /beta (form works; saved even if email API is offline)
- Feature tiles     -> /features/... then Get Started -> /register
- Privacy           -> /privacy-policy

Do NOT upload TitanOS.aab as the website — only the unzipped web files.
"@ | Set-Content (Join-Path $staging "UPLOAD-TO-IONOS.txt") -Encoding UTF8

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Exclude giant binaries from Compress-Archive if needed — include them; user needs them
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

Write-Host "`nIONOS web package ready:"
Write-Host "  $zipPath"
Write-Host "Replace ALL files on IONOS with the contents of this zip."
