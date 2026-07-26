# Quality Guidelines

> How this repo is verified, what the checks do NOT cover, and the traps that
> break CI.

---

## Commands

| Command         | What it does                                                                  |
| --------------- | ----------------------------------------------------------------------------- |
| `npm test`      | Everything: `npm run check` + `node scripts/smoke-test.mjs`                   |
| `npm run check` | `node --check` on the three plugin scripts + `node scripts/validate-repo.mjs` |

There is no single-test filter, no coverage, no lint. CI
(`.github/workflows/ci.yml`) runs `npm test` on Node 22, ubuntu-latest.

## What the smoke test does and does not prove

`scripts/smoke-test.mjs` spawns each server, sends `initialize` +
`tools/list`, and asserts a non-empty tool list within 8 s. It **never calls a
tool** and needs no draw.io install. A passing `npm test` says nothing about
actual drawing behavior — after changing a tool, exercise it for real with the
`mcp-tool-test` skill (manual JSON-RPC against the server).

## validate-repo.mjs traps (`scripts/validate-repo.mjs`)

- **Version pin**: line 18 hardcodes `manifest.version !== "1.0.0"`. Any
  version bump must update that line, `package.json`, `plugin.json`, and
  `CHANGELOG.md` together (use `/bump-version`) or `npm test` fails.
- **Portability scan**: shipped files (marketplace.json, plugin.json,
  .mcp.json, both servers) are scanned for local Windows paths
  (`C:\Users\...`, `ProgramData\miniconda3`) and credential-like strings
  (`gho_`, `github_pat_`). Pasting a local absolute path into any shipped file
  breaks CI.
- It also asserts the marketplace exposes exactly one plugin, names match
  between marketplace and manifest, and both MCP servers (`drawio-live`,
  `drawio-file-utils`) exist in `.mcp.json`.

## Forbidden patterns

- Adding any npm dependency, lockfile, build step, test framework, or
  lint/format tooling (zero-dependency constraint is deliberate).
- `console.log` in server code — stdout is the JSON-RPC channel; log to
  stderr with the `[SERVER_NAME]` prefix.
- Writing a `.drawio` file without running it through `inspectXml` validation.
- Node features newer than Node 22 (local Node may be newer than CI).
- "Fixing" upstream `icebird1998` URLs in README/installers/plugin.json.

## Workflow

- Work on `dev`; `main` is for PRs/releases.
- Commit messages: plain imperative sentence case, no Conventional Commits
  prefixes (e.g. "Document recommended Codex reasoning settings").
- Definition of done for a server change: `npm test` passes **and** the
  changed tool was exercised via `mcp-tool-test` (or a real Codex session)
  when behavior changed.
