# Migrating off the Global Codex Plugin

The upstream project installs the Draw.io Scientific Illustrator as a **global Codex plugin**: available in every Codex session, wherever it runs. This fork adds a **project-local install option**. This page covers moving from a global plugin installation to a project-local setup.

## Do You Need to Migrate?

Only if you want a project-local install for Codex. The global plugin keeps working exactly as before.

You need to migrate if you want project-local isolation because **both register the same two server names**: `drawio-live` and `drawio-file-utils`. Running them side by side gives Codex two sources for the same names.

If you would rather not migrate, install with `--mcp none`: you get the skill files in the project and keep the global plugin's servers.

## Automatic Migration

```bash
node adapters/project-local/install.mjs \
  --project /path/to/your-project \
  --platform codex \
  --migrate-from-global-plugin
```

The order of operations:

1. Install the project-local skill and MCP configuration.
2. **Verify** — spawn both installed servers and confirm they list their tools.
3. Only then remove the global plugin (`codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools`).

If verification fails, the global plugin is left intact so you are never left without a working setup.

## Manual Migration

Equivalent manual steps:

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform codex
codex mcp list                       # confirm the project-local servers are present
codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools
```

## Rolling Back

To revert back to the global plugin:

```bash
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
node adapters/project-local/uninstall.mjs --project /path/to/your-project --remove-platform codex
```
