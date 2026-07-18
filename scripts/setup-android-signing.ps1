$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $Root "android"
$KeystorePath = Join-Path $AndroidDir "titanos-upload.jks"
$PropsPath = Join-Path $AndroidDir "keystore.properties"
$CredsPath = Join-Path $AndroidDir "UPLOAD_KEY_CREDENTIALS.txt"

function Find-JavaHome {
  $candidates = @(
    $env:JAVA_HOME,
    (Join-Path $Root ".tools\jdk-21"),
    "$env:ProgramFiles\Microsoft\jdk-21*",
    "$env:ProgramFiles\Android\Android Studio\jbr"
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate "bin\keytool.exe")) {
      return $candidate
    }
  }
  return $null
}

if (Test-Path $KeystorePath) {
  if (-not (Test-Path $PropsPath)) {
    Write-Error "Keystore exists but keystore.properties is missing. Restore keystore.properties or delete $KeystorePath to regenerate."
  }
  Write-Host "Release keystore already configured: $KeystorePath"
  exit 0
}

$javaHome = Find-JavaHome
if (-not $javaHome) {
  Write-Host "JDK not found. Downloading portable JDK 21..."
  $env:NODE_OPTIONS = "--use-system-ca"
  node (Join-Path $Root "scripts\download-jdk21.js")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $javaHome = Find-JavaHome
}
if (-not $javaHome) {
  Write-Error "JDK with keytool not found."
}

$keyAlias = "titanos-upload"
$storePassword = [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 }))
$keyPassword = $storePassword
$keytool = Join-Path $javaHome "bin\keytool.exe"
$dname = "CN=TitanOS, OU=Mobile, O=TitanOS, L=Unknown, ST=Unknown, C=US"

Write-Host "Creating Play Store upload keystore..."
& $keytool -genkeypair -v `
  -storetype PKCS12 `
  -keystore $KeystorePath `
  -alias $keyAlias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass $storePassword `
  -keypass $keyPassword `
  -dname $dname
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

@"
storeFile=titanos-upload.jks
storePassword=$storePassword
keyAlias=$keyAlias
keyPassword=$keyPassword
"@ | Set-Content $PropsPath -Encoding ASCII

$credentials = @"
TitanOS Google Play upload key
==============================

Keep this file safe. You need it for every future Play Store update.

Keystore file: android/titanos-upload.jks
Key alias:     $keyAlias
Store password: $storePassword
Key password:   $keyPassword

Google Play setup:
1. Create the app in Google Play Console.
2. Upload release/TitanOS.aab.
3. Choose "Google Play App Signing" when prompted (recommended).
4. Back up android/titanos-upload.jks and this credentials file offline.

"@
$credentials | Set-Content $CredsPath -Encoding UTF8

Write-Host "Upload keystore created:"
Write-Host "  $KeystorePath"
Write-Host "  $PropsPath"
Write-Host "  $CredsPath"
