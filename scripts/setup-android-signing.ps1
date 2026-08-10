$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $Root "android"
$KeystorePath = Join-Path $AndroidDir "titanos-upload.jks"
$PropsPath = Join-Path $AndroidDir "keystore.properties"
$ExpectedSha1 = "27:1D:F7:34:AD:18:7E:81:72:F2:06:59:08:E5:31:48:01:4D:B2:8C"

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

function Read-KeystoreProperties {
  param([string]$Path)
  $values = @{}
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
      $values[$Matches[1]] = $Matches[2]
    }
  }
  return $values
}

function Assert-ExpectedUploadKey {
  if (-not (Test-Path $PropsPath)) {
    Write-Error "Play upload keystore exists but keystore.properties is missing. Restore both files from the same signing backup."
  }

  $props = Read-KeystoreProperties $PropsPath
  foreach ($required in @('storePassword', 'keyAlias', 'keyPassword')) {
    if (-not $props[$required]) {
      Write-Error "keystore.properties is missing $required. Restore the enrolled Play signing backup."
    }
  }

  $keytool = Join-Path $javaHome "bin\keytool.exe"
  $details = & $keytool -list -v `
    -keystore $KeystorePath `
    -alias $props['keyAlias'] `
    -storepass $props['storePassword'] 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not open the configured upload keystore. Verify that the keystore and properties came from the same backup."
  }

  $shaLine = $details | Select-String -Pattern 'SHA1:\s*([0-9A-F:]+)' | Select-Object -First 1
  $actualSha1 = if ($shaLine -and $shaLine.Matches.Count) { $shaLine.Matches[0].Groups[1].Value.ToUpperInvariant() } else { '' }
  if ($actualSha1 -ne $ExpectedSha1) {
    Write-Error "Wrong Google Play upload key. Expected SHA1 $ExpectedSha1 but configured key is $actualSha1. Build stopped before producing an invalid AAB."
  }

  Write-Host "Verified Google Play upload certificate: SHA1 $ExpectedSha1"
}

if (Test-Path $KeystorePath) {
  Assert-ExpectedUploadKey
  Write-Host "Release keystore already configured: $KeystorePath"
  exit 0
}

Write-Error "The enrolled Google Play upload keystore is missing. Restore android/titanos-upload.jks and android/keystore.properties from the signing backup. Do not generate a replacement key for an existing Play app."
