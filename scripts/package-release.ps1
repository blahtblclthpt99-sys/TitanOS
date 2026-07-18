$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Installing dependencies..."
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

$ReleaseDir = Join-Path $Root "release"
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
  "dist"
)

foreach ($item in $Include) {
  $source = Join-Path $Root $item
  if (Test-Path $source) {
    Copy-Item -Path $source -Destination (Join-Path $StagingDir $item) -Recurse -Force
  }
}

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path (Join-Path $StagingDir "*") -DestinationPath $ZipPath -Force
Remove-Item $StagingDir -Recurse -Force

Write-Host "`nRelease archive created: $ZipPath"
