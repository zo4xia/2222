param(
  [ValidateSet('read', 'monitor')]
  [string]$Mode = 'read',
  [string]$BrowserPath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$runtimeNode = Join-Path $repoRoot 'runtime\node\node.exe'
$nodeCommand = if (Test-Path -LiteralPath $runtimeNode) { $runtimeNode } else { 'node' }

if ($BrowserPath -and (Test-Path -LiteralPath $BrowserPath)) {
  $env:CLEANROOM_CHROMIUM_PATH = $BrowserPath
}

$scriptName = if ($Mode -eq 'monitor') {
  'debug-browser-monitor.mjs'
} else {
  'debug-read-browser-project.mjs'
}

$scriptPath = Join-Path $PSScriptRoot $scriptName
if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "Missing debug script: $scriptPath"
}

& $nodeCommand $scriptPath
exit $LASTEXITCODE
