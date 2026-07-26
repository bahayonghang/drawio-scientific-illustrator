# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Codex plugin marketplace shipping one plugin. The shipped product lives entirely under `plugins/drawio-scientific-illustrator/`: two hand-rolled MCP stdio servers (`scripts/live-server.mjs`, `scripts/server.mjs`) that drive draw.io Desktop. Root `scripts/` are repo validation only, not part of the product.

This is a fork of `icebird1998/drawio-scientific-illustrator` (origin is `bahayonghang`). README, installers, and `plugin.json` still reference upstream `icebird1998` — do not "fix" those URLs. `drawio-project-local-skill-execution-plan.md` is a non-binding draft, not an accepted spec.

## Zero-dependency constraint (deliberate)

No npm dependencies, no lockfile, no build step, no test framework, no lint/format tooling. The servers implement newline-delimited JSON-RPC over stdio by hand. Do not add `@modelcontextprotocol/sdk`, a test runner, prettier/eslint, or any package unless explicitly asked.

## Commands

- `npm test` — everything: `npm run check` + `node scripts/smoke-test.mjs`
- `npm run check` — `node --check` on the three server scripts + `node scripts/validate-repo.mjs`
- The smoke test spawns both servers and asserts `tools/list` is non-empty (8 s timeout per server). It never calls a tool and needs no draw.io install, so passing tests say nothing about actual drawing behavior. There is no single-test filter.

## Gotchas

- `scripts/validate-repo.mjs:18` hardcodes `version !== "1.0.0"` — any version bump must update that line, `package.json`, `plugin.json`, and `CHANGELOG.md` together or `npm test` fails (use `/bump-version`).
- `validate-repo.mjs` scans shipped files for local Windows paths (`C:\Users\...`) and credential patterns — pasting a local absolute path into any plugin file breaks CI.
- `.agents/`, `.claude/`, `.codex/` are gitignored, but `.agents/plugins/marketplace.json` was committed earlier and is still tracked — it is required by `validate-repo.mjs` and CI; don't treat it as local-only.
- CI runs Node 22 (`engines: >=22`); local Node may be newer — target 22 for compatibility decisions.

## Conventions

- ESM `.mjs`, 2-space indent, double quotes, semicolons, `node:`-prefixed core imports.
- Work on `dev`; commit messages are plain imperative sentence case (no Conventional Commits prefixes).
- New docs in English (existing README/PRIVACY are intentionally bilingual EN + 中文).
- `AGENTS.md` content between the `TRELLIS:START/END` markers is managed by `trellis update` — don't hand-edit it.
