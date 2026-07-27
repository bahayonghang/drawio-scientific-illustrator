# Getting Started

## Prerequisites

Before installing the plugin, ensure your environment meets the following requirements:

1. **Codex Desktop App or Codex CLI** (with plugin support).
2. **[draw.io Desktop](https://www.drawio.com/)** installed locally.
3. **Git**.
4. **Node.js 22 or newer** (available in system `PATH` if running outside bundled Codex environment).

## Installation Methods

### Method 1: Ask Codex (Easiest)

Paste the following message directly into a Codex chat session with terminal access enabled:

```text
Install the public Codex plugin from https://github.com/icebird1998/drawio-scientific-illustrator.
Clone it locally, register its repository root as a Codex marketplace, install
drawio-scientific-illustrator@drawio-scientific-tools, then tell me when to restart Codex.
```

### Method 2: Using just (Automated OS & Platform Selection)

If you have `just` installed, run:

```bash
just install          # Default: installs for Codex
just install codex    # Installs for Codex
just install claude   # Installs project-local skill & MCP for Claude Code
just install both     # Installs project-local skill & MCP for both Codex & Claude Code
```

This automatically detects Windows or macOS/Linux and triggers the installer script with the specified platform.

### Method 3: One-Command Install Scripts

**Windows (PowerShell)**:
```powershell
$p="$env:TEMP\drawio-scientific-install.ps1"; Invoke-WebRequest https://raw.githubusercontent.com/icebird1998/drawio-scientific-illustrator/main/install.ps1 -OutFile $p; powershell -ExecutionPolicy Bypass -File $p
```

**macOS / Linux (Bash)**:
```bash
curl -fsSL https://raw.githubusercontent.com/icebird1998/drawio-scientific-illustrator/main/install.sh | bash
```

> **Important**: After running the script, restart Codex and create a **new task** to load the newly registered skill and tools.

## Development & Local Documentation

To start the local VitePress documentation development server:

```bash
just docs
```

### Method 3: Manual Installation

**PowerShell**:
```powershell
git clone https://github.com/icebird1998/drawio-scientific-illustrator.git
Set-Location drawio-scientific-illustrator
codex plugin marketplace add (Get-Location).Path
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

**Bash**:
```bash
git clone https://github.com/icebird1998/drawio-scientific-illustrator.git
cd drawio-scientific-illustrator
codex plugin marketplace add "$(pwd)"
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```
