$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location -LiteralPath $RepoRoot

$OutDir = Join-Path $RepoRoot 'batons\auto'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$LatestPath = Join-Path $OutDir 'latest.md'
$Stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$Head = git rev-parse --short HEAD
$Branch = git rev-parse --abbrev-ref HEAD
$Tracked = @(git status --porcelain=v1 -uno)
$Untracked = @(git status --porcelain=v1 | Where-Object { $_ -like '?? *' })
$Recent = git log --oneline -5

$trackedState = if ($Tracked.Count -eq 0) { 'clean' } else { "dirty tracked=$($Tracked.Count)" }

$body = @"
# auto baton latest

updated: $Stamp

## git
- branch: $Branch
- head: $Head
- tracked: $trackedState
- untracked: $($Untracked.Count)

## completion rule
- no full user flow proof: NOT COMPLETE
- typecheck / local smoke / commit: evidence only, not OK

## chain
1. scripts/auto-checkpoint.ps1
2. scripts/write-continuity-summary.ps1
3. scripts/auto-continuity-chain.ps1
4. Windows Task: XiaxiaTeachingCutAutoCheckpoint

## recent commits
``````
$($Recent -join "`n")
``````

## next
- run real user flow
- screenshot major stages
- verify C visible/selectable/draggable/tunable and GoldenFinger boundary with browser evidence
"@

Set-Content -LiteralPath $LatestPath -Encoding UTF8 -Value $body
Write-Output $LatestPath
