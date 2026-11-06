$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = $package.version
$dist = Join-Path $projectRoot 'dist'
$bundle = Join-Path $dist "Typewriter-$version-Windows"
New-Item -ItemType Directory -Force -Path $bundle | Out-Null
Copy-Item -LiteralPath (Join-Path $dist "Typewriter-$version-portatil.exe") -Destination $bundle
Copy-Item -Path (Join-Path $projectRoot 'materiais\*') -Destination $bundle -Force
$zip = Join-Path $dist "Typewriter-$version-Windows.zip"
Compress-Archive -LiteralPath $bundle -DestinationPath $zip -Force
Get-Item -LiteralPath $zip | Select-Object FullName, Length
