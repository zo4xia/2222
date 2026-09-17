$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$CheckpointScript = Join-Path $ScriptDir 'auto-continuity-chain.ps1'
$TaskName = 'XiaxiaTeachingCutAutoCheckpoint'

if (-not (Test-Path -LiteralPath $CheckpointScript)) {
  throw "Missing checkpoint script: $CheckpointScript"
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$CheckpointScript`"" `
  -WorkingDirectory $RepoRoot

$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 30) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Repo-local continuity chain: typecheck checkpoint, then write latest baton.' `
  -Force | Out-Null

Write-Output "Installed task: $TaskName"
Write-Output "Repo root: $RepoRoot"
Write-Output "Script: $CheckpointScript"
