param(
  [string]$Platform = "codex",
  [string]$InstallDir = "$HOME\.codex\marketplaces\drawio-scientific-illustrator"
)

$ErrorActionPreference = "Stop"
$Repository = "https://github.com/icebird1998/drawio-scientific-illustrator.git"
$Plugin = "drawio-scientific-illustrator@drawio-scientific-tools"

$PlatformLower = $Platform.ToLower()

if ($PlatformLower -eq "claude") {
  Write-Host "Installing project-local skill for Claude Code..."
  node adapters/project-local/install.mjs --project . --platform claude
  exit 0
}

if ($PlatformLower -eq "both" -or $PlatformLower -eq "all") {
  Write-Host "Installing project-local skill for Claude Code and Codex..."
  node adapters/project-local/install.mjs --project . --platform both
  exit 0
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required. Install Git for Windows, then run this installer again."
}

if (Get-Command codex -ErrorAction SilentlyContinue) {
  if (Test-Path (Join-Path $InstallDir ".git")) {
    git -C $InstallDir pull --ff-only
  } elseif (Test-Path $InstallDir) {
    throw "Install directory exists but is not this Git repository: $InstallDir"
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir -Parent) | Out-Null
    git clone $Repository $InstallDir
  }

  codex plugin marketplace add $InstallDir
  codex plugin add $Plugin

  Write-Host "Installed $Plugin for Codex"
  Write-Host "Restart Codex and start a new task before first use."
} else {
  Write-Host "Codex CLI not found globally. Installing project-local skill for Codex..."
  node adapters/project-local/install.mjs --project . --platform codex
}
