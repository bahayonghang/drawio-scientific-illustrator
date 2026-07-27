set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

# Default recipe listing available commands
default:
    @just --list

# Automatically detect OS and run installation script for specified platform (codex, claude, both)
[no-cd]
install platform="codex":
    @{{ if os() == "windows" { "powershell -ExecutionPolicy Bypass -File .\\install.ps1 " + platform } else { "bash ./install.sh " + platform } }}

# Start VitePress documentation development server
docs:
    npx vitepress dev docs

# Build static VitePress documentation
docs-build:
    npx vitepress build docs
