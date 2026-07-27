# Baseline freeze — evidence

Recorded 2026-07-27 on branch `dev`.

## Environment

| Item                  | Value                                      |
| --------------------- | ------------------------------------------ |
| Node (local)          | v25.9.0                                    |
| Node (CI / `engines`) | >=22 → target 22                           |
| `dev` HEAD            | `931226bb8e020d87ecacd3aaecab4dafb62ffa15` |
| `upstream/main`       | `e6bc28d36b38bfb8586eb66adb6d058a4644e427` |

## Git remotes

`upstream` was **missing** before this task; added and fetched.

```
origin    https://github.com/bahayonghang/drawio-scientific-illustrator.git (fetch/push)
upstream  https://github.com/icebird1998/drawio-scientific-illustrator.git (fetch/push)
```

`git fetch upstream --prune` → ok (2 new refs).

## Core area is untouched

```
$ git diff upstream/main -- plugins/drawio-scientific-illustrator
(empty)
```

`git diff --stat upstream/main -- .` shows 61 files, **12783 insertions, 0 deletions** —
all additions outside `plugins/`: `.trellis/**`, `.github/**`, `AGENTS.md`, `CLAUDE.md`,
`drawio-project-local-skill-execution-plan.md`. Core area verified clean.

## Baseline `npm test`

```
> npm run check && node scripts/smoke-test.mjs
Repository structure and portability checks passed.
plugins/drawio-scientific-illustrator/scripts/live-server.mjs: 11 tools
plugins/drawio-scientific-illustrator/scripts/server.mjs: 9 tools
MCP smoke tests passed.
```

Green. `live-server` exposes 11 tools, `server` exposes 9.

## `scripts/validate-repo.mjs` scan scope — **does NOT cover new files**

Read at `scripts/validate-repo.mjs:21-34`. The local-path / credential regex
(`C:\Users\…`, `ProgramData\miniconda3`, `gho_`, `github_pat_`) runs over an
**explicit five-file list only**:

1. `.agents/plugins/marketplace.json`
2. `plugins/…/.codex-plugin/plugin.json`
3. `plugins/…/.mcp.json`
4. `plugins/…/scripts/live-server.mjs`
5. `plugins/…/scripts/server.mjs`

Consequences for later subtasks:

- **`adapters/**`, `docs/**`, `README.dev.md`, `.github/workflows/**`, and test
  fixtures are NOT scanned.** The "no local absolute paths" rule stays a _convention_
  we follow for portability, but CI will not catch a violation there.
- Subtask 6 (tests-and-ci) should decide whether to extend the file list to cover
  `adapters/**`. `scripts/` at repo root is validation-only tooling, not the shipped
  product, so editing it does not touch the frozen core area — but it does widen the
  rebase surface against upstream. **Recommendation: extend it, and keep the change to
  a single glob-walk addition.** Deferred to subtask 6, not decided here.
- Note `drawio-path.mjs` is `node --check`ed but _not_ path-scanned. Pre-existing gap;
  out of scope.

## Other observations

- Plugin ships exactly 7 files (3 scripts, SKILL.md, agents/openai.yaml, plugin.json,
  .mcp.json) — matches the assembly manifest in the parent `design.md` §2.
- `package.json` has only `check` and `test` scripts; adding `test:project-local` /
  `test:all` is a pure append (parent `design.md` §1).
- Version `1.0.0` is asserted at `scripts/validate-repo.mjs:18`; this task changes no
  version, per parent PRD.
