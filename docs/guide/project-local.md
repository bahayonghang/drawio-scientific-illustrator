# Project-Local Installation Guide

The upstream plugin installs globally for Codex only. This fork adds a second option: placing the skill and both MCP servers **inside a single project directory**, supporting both **Claude Code** and **Codex**, with no dependency on where this repository lives.

## Requirements

- **Node.js 22 or newer**. Verify with `node --version`.
- **draw.io Desktop** installed locally.
- **A clone of this repository** to run the adapter installation script.

## Installation Command

Run the installation adapter script from the root of this repository:

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform both
```

You can specify `--platform claude`, `--platform codex`, or `--platform both`.

### Dry-Run Mode

To inspect what changes will be written without modifying any files:

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform both --dry-run
```

## Structure Written to Target Project

```
your-project/
├── .claude/skills/recreate-scientific-figure-in-drawio/   # Claude Code Skill
│   ├── SKILL.md
│   ├── agents/openai.yaml
│   └── scripts/{live-server,server,drawio-path}.mjs
├── .agents/skills/recreate-scientific-figure-in-drawio/   # Codex Skill
├── .mcp.json                                              # Claude Code MCP configuration
├── .codex/config.toml                                     # Codex MCP configuration
└── .agents/drawio-scientific-install.json                 # Installation manifest
```

## Verification

### Claude Code

Start a session from the project root:

```bash
cd /path/to/your-project
claude
```

Type `/mcp` to verify that `drawio-live` and `drawio-file-utils` are active.

### Codex

Start a session in the project directory and run:

```bash
codex mcp list
```

Verify both servers are enabled.

## Uninstalling Project-Local Setup

To cleanly remove the project-local files:

```bash
node adapters/project-local/uninstall.mjs --project /path/to/your-project --remove-platform both
```
