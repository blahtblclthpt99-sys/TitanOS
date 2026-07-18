$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Find-JavaHome {
  $root = Split-Path -Parent $PSScriptRoot
  # Prefer project JDK 21 — system JAVA_HOME is often 17 and fails Capacitor builds.
  $candidates = @(
    (Join-Path $root ".tools\jdk-21"),
    "$env:ProgramFiles\Microsoft\jdk-21*",
    "$env:ProgramFiles\Android\Android Studio\jbr",
    "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
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

function Find-AndroidSdk {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk"
  ) | Where-Object { $_ -and (Test-Path $_) }

  return $candidates | Select-Object -First 1
}

Write-Host "Building web assets..."
$env:VITE_CAPACITOR_BUILD = "true"
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

$javaHome = Find-JavaHome
if (-not $javaHome) {
  Write-Host "Portable JDK 21 not found. Downloading..."
  $env:NODE_OPTIONS = "--use-system-ca"
  node (Join-Path $Root "scripts\download-jdk21.js")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $javaHome = Find-JavaHome
}
$sdkRoot = Find-AndroidSdk

if (-not $javaHome) {
  Write-Error "Java JDK not found. Install Android Studio or Microsoft OpenJDK 17, then rerun npm run android:build"
}
if (-not $sdkRoot) {
  Write-Error "Android SDK not found. Install Android Studio and the Android SDK, then rerun npm run android:build"
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:JAVA_TOOL_OPTIONS = "-Djavax.net.ssl.trustStoreType=Windows-ROOT"
$env:PATH = "$javaHome\bin;$sdkRoot\platform-tools;$sdkRoot\cmdline-tools\latest\bin;$env:PATH"

$androidDir = Join-Path $Root "android"
Set-Location $androidDir

Write-Host "`nBuilding debug APK..."
.\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nConfiguring Play Store signing..."
& (Join-Path $Root "scripts\setup-android-signing.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nBuilding release AAB..."
.\gradlew.bat bundleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location $Root

$apkSource = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
$aabSource = Join-Path $androidDir "app\build\outputs\bundle\release\app-release.aab"
$apkDest = Join-Path $Root "public\downloads\TitanOS.apk"
$aabDest = Join-Path $Root "release\TitanOS.aab"

New-Item -ItemType Directory -Force -Path (Split-Path $apkDest) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $aabDest) | Out-Null

Copy-Item $apkSource $apkDest -Force
Copy-Item $aabSource $aabDest -Force

Write-Host "`nPreparing email-safe APK share package..."
& (Join-Path $Root "scripts\prepare-apk-share.ps1")

Write-Host "`nAndroid build complete:"
Write-Host "  APK: $apkDest"
Write-Host "  AAB: $aabDest"
Write-Host "  Email share: $(Join-Path $Root 'release\TitanOS-EmailShare.zip')"
