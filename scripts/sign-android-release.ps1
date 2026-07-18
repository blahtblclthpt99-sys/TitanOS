$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Building web assets for Capacitor..."
$env:VITE_CAPACITOR_BUILD = "true"
$env:NODE_OPTIONS = "--use-system-ca"
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Never ship website APK/AAB binaries inside the Android WebView assets
$distDir = Join-Path $Root "dist"
Get-ChildItem -Path $distDir -Recurse -Include *.apk,*.aab -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Excluding from Capacitor package: $($_.FullName)"
  Remove-Item $_.FullName -Force
}

Write-Host "Syncing Capacitor Android project..."
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $Root "scripts\setup-android-signing.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

function Find-JavaHome {
  # Prefer project JDK 21 — system JAVA_HOME is often 17 and fails Capacitor builds.
  $candidates = @(
    (Join-Path $Root ".tools\jdk-21"),
    "$env:ProgramFiles\Microsoft\jdk-21*",
    $env:JAVA_HOME
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($candidate in $candidates) {
    $resolved = Get-Item $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
    $homePath = if ($resolved) { $resolved.FullName } else { $candidate }
    if (Test-Path (Join-Path $homePath "bin\java.exe")) {
      return $homePath
    }
  }
  return $null
}

$javaHome = Find-JavaHome
$sdkRoot = $env:ANDROID_HOME
if (-not $sdkRoot -or -not (Test-Path $sdkRoot)) {
  $sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}

if (-not $javaHome) {
  $env:NODE_OPTIONS = "--use-system-ca"
  node (Join-Path $Root "scripts\download-jdk21.js")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $javaHome = Find-JavaHome
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:JAVA_TOOL_OPTIONS = "-Djavax.net.ssl.trustStoreType=Windows-ROOT"
$env:PATH = "$javaHome\bin;$sdkRoot\platform-tools;$env:PATH"

$androidDir = Join-Path $Root "android"
Set-Location $androidDir

Write-Host "Building signed release AAB..."
.\gradlew.bat bundleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building signed release APK..."
.\gradlew.bat assembleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location $Root
$aabSource = Join-Path $androidDir "app\build\outputs\bundle\release\app-release.aab"
$apkSource = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
$aabDest = Join-Path $Root "release\TitanOS.aab"
$apkDest = Join-Path $Root "release\TitanOS.apk"
$publicApk = Join-Path $Root "public\downloads\TitanOS.apk"

New-Item -ItemType Directory -Force -Path (Split-Path $aabDest) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $publicApk) | Out-Null
Copy-Item $aabSource $aabDest -Force
if (Test-Path $apkSource) {
  Copy-Item $apkSource $apkDest -Force
  Copy-Item $apkSource $publicApk -Force
}

Write-Host "`nPlay Store upload (AAB):"
Write-Host "  $aabDest"
if (Test-Path $apkDest) {
  Write-Host "Tester / sideload APK:"
  Write-Host "  $apkDest"
}
Write-Host "Upload key credentials:"
Write-Host "  $(Join-Path $androidDir 'UPLOAD_KEY_CREDENTIALS.txt')"
