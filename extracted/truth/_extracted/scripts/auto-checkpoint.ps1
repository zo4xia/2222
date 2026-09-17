$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location -LiteralPath $RepoRoot

$LogDir = Join-Path $RepoRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogPath = Join-Path $LogDir 'auto-checkpoint.log'

function Write-CheckpointLog {
  param([string] $Message)
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value "[$stamp] $Message"
}

try {
  $head = git rev-parse --short HEAD
  $tracked = git status --porcelain=v1 -uno
  $untrackedCount = (git status --porcelain=v1 | Where-Object { $_ -like '?? *' } | Measure-Object).Count

  if (-not $tracked) {
    Write-CheckpointLog "clean tracked tree at $head; untracked=$untrackedCount"
    exit 0
  }

  Write-CheckpointLog "tracked changes detected at $head; running typecheck"
  npm run typecheck *> (Join-Path $LogDir 'auto-checkpoint-typecheck.last.log')

  git add -u
  $staged = git diff --cached --name-only
  if (-not $staged) {
    Write-CheckpointLog 'no staged tracked changes after git add -u'
    exit 0
  }

  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
  git commit -m "checkpoint: auto save tracked work $stamp"
  $newHead = git rev-parse --short HEAD
  Write-CheckpointLog "committed $newHead; untracked=$untrackedCount"
} catch {
  Write-CheckpointLog "failed: $($_.Exception.Message)"
  exit 1
}
