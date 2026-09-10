param(
  [Parameter(Mandatory = $false)]
  [ValidatePattern('^http://[^/]+(?::\d+)?$')]
  [string]$AppUrl = 'http://127.0.0.1:5173',

  [switch]$Kiosk
)

$edgeCandidates = @(
  "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$edgePath = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edgePath) {
  throw 'Microsoft Edge was not found.'
}

$profilePath = Join-Path $env:LOCALAPPDATA 'PoostaKioskEdge'
$arguments = @(
  ('--user-data-dir="' + $profilePath + '"'),
  "--unsafely-treat-insecure-origin-as-secure=$AppUrl",
  '--autoplay-policy=no-user-gesture-required',
  '--no-first-run'
)
if ($Kiosk) { $arguments += '--kiosk' }
$arguments += $AppUrl

Write-Host "Opening Poosta at $AppUrl"
Write-Host 'On first use, allow Camera access in Edge.'
Start-Process -FilePath $edgePath -ArgumentList $arguments
