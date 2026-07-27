# Fork development guide

This document is for people working **on** this fork. If you just want to use the
plugin, read [`README.md`](README.md) instead.

## What this fork is for

Upstream [`icebird1998/drawio-scientific-illustrator`](https://github.com/icebird1998/drawio-scientific-illustrator)
ships a Codex plugin marketplace that installs the Draw.io Scientific Illustrator
**globally**. This fork adds a second, optional delivery path: installing the same
skill and its two MCP servers **into a single project directory**, self-contained, for
both Claude Code and Codex.

The upstream product is not modified. Everything new lives outside the core area.

## Branches

| Branch | Role                                                                     |
| ------ | ------------------------------------------------------------------------ |
| `main` | Mirrors `upstream/main`. Fast-forward only — never commit here directly. |
| `dev`  | Carries all fork work. Rebased onto `main` after each upstream sync.     |

## Core area — do not modify

These paths must stay byte-identical to upstream so syncs never conflict:

- `plugins/**` — the shipped plugin (2 MCP servers, skill, manifests)
- `install.ps1`, `install.sh` — global installers
- `README.md`
- `.agents/plugins/marketplace.json`

Verify with:

```bash
git diff upstream/main -- plugins/drawio-scientific-illustrator
```

Empty output means the core area is clean. The project-local installer **assembles**
its skill package from these files at install time; it never keeps a second copy in
the repository.

## Remotes

```bash
git remote add upstream https://github.com/icebird1998/drawio-scientific-illustrator.git
git fetch upstream --prune
```

`origin` points at `bahayonghang/drawio-scientific-illustrator`.

## Constraints inherited from upstream

- **Zero dependencies.** No npm packages, no lockfile, no build step, no test
  framework, no linter. The MCP servers hand-roll newline-delimited JSON-RPC over
  stdio. New code follows the same rule — use `node:` built-ins and `node --test`.
- **Node >= 22.** CI runs 22; local may be newer.
- ESM `.mjs`, 2-space indent, double quotes, semicolons.
- Commit messages: plain imperative sentence case, no Conventional Commits prefixes.
- New documentation is written in English. The bilingual EN + 中文 style of
  `README.md` and `PRIVACY.md` is intentional but not extended to new files.

## Validation

```bash
npm test
```

Runs `node --check` on the three server scripts, `scripts/validate-repo.mjs`, and a
smoke test that spawns both MCP servers and asserts `tools/list` is non-empty. The
smoke test never calls a tool and needs no draw.io installation, so a green run says
nothing about actual drawing behaviour.

Note that `scripts/validate-repo.mjs` scans only five specific files for local
absolute paths and credential-like strings. New directories are not covered — keep
machine-specific paths out of committed files by hand.

## Project-local installation

Install the skill and both MCP servers into a target project. See
[`docs/project-local-install.md`](docs/project-local-install.md).

## Migrating off the global Codex plugin

See [`docs/migration-from-global-plugin.md`](docs/migration-from-global-plugin.md).

## Syncing with upstream

See [`docs/upstream-sync.md`](docs/upstream-sync.md).
