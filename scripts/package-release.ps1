$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$pkg = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
$versionName = $pkg.version
$gradle = Get-Content (Join-Path $Root "android\app\build.gradle") -Raw
$versionCode = if ($gradle -match 'versionCode\s+(\d+)') { $Matches[1] } else { "?" }

Write-Host "Packaging TitanOS $versionName (versionCode $versionCode)..."

Write-Host "`nInstalling dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nRunning lint..."
npm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nRunning typecheck (non-blocking)..."
npm run typecheck
if ($LASTEXITCODE -ne 0) {
  Write-Warning "Typecheck reported issues - continuing with release packaging."
}

Write-Host "`nBuilding production bundle..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Keep website download buttons on the signed Play binaries
$ReleaseDir = Join-Path $Root "release"
$aabPath = Join-Path $ReleaseDir "TitanOS.aab"
$apkPath = Join-Path $ReleaseDir "TitanOS.apk"
$publicDownloads = Join-Path $Root "public\downloads"
New-Item -ItemType Directory -Force -Path $publicDownloads | Out-Null
if (Test-Path $apkPath) {
  Copy-Item $apkPath (Join-Path $publicDownloads "TitanOS.apk") -Force
  Write-Host "Synced public/downloads/TitanOS.apk"
}
if (Test-Path $aabPath) {
  Copy-Item $aabPath (Join-Path $publicDownloads "TitanOS.aab") -Force
  Write-Host "Synced public/downloads/TitanOS.aab"
}

$StagingDir = Join-Path $ReleaseDir "TitanOS"
$ZipPath = Join-Path $ReleaseDir "TitanOS_Production.zip"

if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $StagingDir | Out-Null

$Include = @(
  "src",
  "api",
  "supabase",
  "public",
  "scripts",
  "capacitor.config.json",
  "index.html",
  "package.json",
  "package-lock.json",
  "vite.config.js",
  "tailwind.config.js",
  "postcss.config.js",
  "jsconfig.json",
  "eslint.config.js",
  "vercel.json",
  ".env.example",
  "README.md",
  "AGENTS.md",
  "PLAY_TESTING.md",
  "dist"
)

foreach ($item in $Include) {
  $source = Join-Path $Root $item
  if (Test-Path $source) {
    Copy-Item -Path $source -Destination (Join-Path $StagingDir $item) -Recurse -Force
  }
}

$binDir = Join-Path $StagingDir "release"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
foreach ($bin in @($aabPath, $apkPath)) {
  if (Test-Path $bin) {
    Copy-Item $bin (Join-Path $binDir (Split-Path $bin -Leaf)) -Force
  }
}

@"
TitanOS release package
=======================
versionName: $versionName
versionCode: $versionCode
package:     com.titanos.myapp
built:       $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Play Console upload
-------------------
Upload ONLY: release/TitanOS.aab
Do not upload the APK to Play (sideload / testers only).
Opt-in: https://play.google.com/apps/testing/com.titanos.myapp

Web
---
Production: https://titanos-web.vercel.app
Deploy: npx vercel --prod --yes

Android rebuild
---------------
npm run android:sign
"@ | Set-Content (Join-Path $StagingDir "RELEASE.txt") -Encoding UTF8

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path (Join-Path $StagingDir "*") -DestinationPath $ZipPath -Force
Remove-Item $StagingDir -Recurse -Force

Write-Host "`nRelease archive created: $ZipPath"
Write-Host "Play AAB (upload this): $aabPath"
if (Test-Path $apkPath) { Write-Host "Sideload APK: $apkPath" }
