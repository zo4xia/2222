$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location -LiteralPath $RepoRoot

& (Join-Path $ScriptDir 'auto-checkpoint.ps1')
& (Join-Path $ScriptDir 'write-continuity-summary.ps1') | Out-Null
