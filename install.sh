#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:-codex}"
INSTALL_DIR="${2:-$HOME/.codex/marketplaces/drawio-scientific-illustrator}"
REPOSITORY="https://github.com/icebird1998/drawio-scientific-illustrator.git"
PLUGIN="drawio-scientific-illustrator@drawio-scientific-tools"

PLATFORM_LOWER=$(echo "$PLATFORM" | tr '[:upper:]' '[:lower:]')

if [[ "$PLATFORM_LOWER" == "claude" ]]; then
  echo "Installing project-local skill for Claude Code..."
  node adapters/project-local/install.mjs --project . --platform claude
  exit 0
fi

if [[ "$PLATFORM_LOWER" == "both" ]] || [[ "$PLATFORM_LOWER" == "all" ]]; then
  echo "Installing project-local skill for Claude Code and Codex..."
  node adapters/project-local/install.mjs --project . --platform both
  exit 0
fi

command -v git >/dev/null || { echo "Git is required." >&2; exit 1; }

if command -v codex >/dev/null 2>&1; then
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    git -C "$INSTALL_DIR" pull --ff-only
  elif [[ -e "$INSTALL_DIR" ]]; then
    echo "Install directory exists but is not this Git repository: $INSTALL_DIR" >&2
    exit 1
  else
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPOSITORY" "$INSTALL_DIR"
  fi

  codex plugin marketplace add "$INSTALL_DIR"
  codex plugin add "$PLUGIN"

  echo "Installed $PLUGIN for Codex"
  echo "Restart Codex and start a new task before first use."
else
  echo "Codex CLI not found globally. Installing project-local skill for Codex..."
  node adapters/project-local/install.mjs --project . --platform codex
fi
