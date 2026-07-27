# Migrating off the global Codex plugin

The upstream project installs the Draw.io Scientific Illustrator as a **global Codex
plugin**: available in every Codex session, wherever it runs. This fork adds a
project-local install. This page covers moving from the first to the second.

Nothing here applies to Claude Code — it was never part of the global plugin.

## Do you actually need to migrate?

Only if you want the project-local install for Codex. The global plugin keeps
working exactly as before; this fork does not change it.

You need to migrate because **both register the same two server names**,
`drawio-live` and `drawio-file-utils`. Running them side by side gives Codex two
sources for the same names, and which one wins is not something you should have to
reason about. The installer detects this and warns rather than letting it happen
quietly.

If you would rather not migrate, install with `--mcp none`: you get the skill files
in the project and keep the global plugin's servers.

## The migration

```bash
node adapters/project-local/install.mjs \
  --project /path/to/your-project \
  --platform codex \
  --migrate-from-global-plugin
```

The order matters, and the installer enforces it:

1. Install the project-local skill and MCP configuration.
2. **Verify** — spawn both installed servers and confirm they list their tools.
3. Only then run `codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools`.

If verification fails, the global plugin is left alone. You are never left with
neither working.

Two guards reject the request up front, before anything is written:

- `--platform claude` — the flag only means anything for Codex.
- `--skip-verification` — removing the global plugin without verifying the
  replacement is the exact failure this ordering exists to prevent.

The `codex` CLI must be on `PATH`, or the installer stops and tells you to drop the
flag.

## After migrating

Start a **new** Codex session — configuration is read at session start — and check:

```bash
codex mcp list
```

You should see `drawio-live` and `drawio-file-utils` once each, pointing at your
project's `.agents/skills/recreate-scientific-figure-in-drawio/scripts/`.

## Rolling back

The migration removes the plugin registration but leaves the marketplace checkout on
disk, so reinstalling is one command:

```bash
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

Then remove the project-local Codex install so the names stop colliding:

```bash
node adapters/project-local/uninstall.mjs --project /path/to/your-project --remove-platform codex
```

## Migrating by hand

The flag is a convenience. Equivalent manual steps:

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform codex
codex mcp list                       # confirm the project-local servers are there
codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools
```

Do the `codex mcp list` check for real. It is the whole point of the ordering.

## One limitation this makes more visible

The global plugin worked in every project. The project-local install, on Codex,
works in **one project at a time** — codex-cli 0.145.0 ignores project-level
`mcp_servers` ([openai/codex#13025](https://github.com/openai/codex/issues/13025)),
so the user-level config is what takes effect, and it is global.

If you use draw.io drawing across many projects on Codex today, the global plugin
may still suit you better. Once #13025 is fixed, the project-level configuration the
installer already writes starts working and the limitation disappears on its own.

See [Installing into a single project](project-local-install.md#codex-can-only-be-bound-to-one-project-at-a-time)
for how the installer handles a rebind.
