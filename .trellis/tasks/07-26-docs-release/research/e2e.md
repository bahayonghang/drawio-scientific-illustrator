# Windows end-to-end verification

Date: 2026-07-27. Windows 11 Pro 26200, Node 25.9.0, draw.io Desktop at
`C:\Program Files\draw.io\draw.io.exe`, codex-cli with the global plugin
`drawio-scientific-illustrator@drawio-scientific-tools` still installed.

## Setup

To make "delete the fork and it still works" a real test rather than an assertion,
the install was run from a **copy** of the fork (`adapters/` + `plugins/` only) in a
scratch directory, not from the working checkout. The copy was deleted before any
tool was called.

- Target: a fresh `git init` project with one committed `README.md`, clean tree.
- Control: a second fresh `git init` project, never installed into.

## Baseline

`~/.codex/config.toml` before anything ran:

```
sha256 017c2bf541df8d9ae540722a94576f28dd00c2198c1f77621871c447a1ed5a91
bytes  17893
```

## 1. Install

`install.mjs --project <target> --platform both --mcp project` → exit 0.

- Both skill packages assembled; verification reported
  `skill package responds to tools/list`.
- The global-plugin coexistence warning fired, naming both colliding server names.
  This is the warning that never fired before subtask 4 fixed `codex` detection on
  Windows — first observation of it working in a real install.
- `codex mcp list` showed `drawio-live` and `drawio-file-utils`, both `enabled`,
  `cwd` pointing at
  `<target>/.agents/skills/recreate-scientific-figure-in-drawio`.

## 2. Delete the fork, then draw

The fork copy was deleted (`existsSync → false`), then the **installed** copy of
`live-server.mjs` was driven directly over stdio JSON-RPC:

| Tool                           | Result                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| `drawio_live_launch`           | `connected: true`, port 9333, draw.io auto-detected                |
| `drawio_live_add_shape` ×2     | `n1` "Sample A", `n2` "Sample B" placed                            |
| `drawio_live_add_edge`         | edge `n1 → n2` labelled "flows to"                                 |
| `drawio_live_fit`              | `zoom_percent: 360`, image returned                                |
| `drawio_live_screenshot`       | image content part returned                                        |
| `drawio_live_save_snapshot`    | 987 bytes written                                                  |
| `drawio_validate` (file-utils) | `valid: true`                                                      |
| `drawio_inspect` (file-utils)  | both vertices and the edge listed                                  |
| `drawio_export` format `png`   | 7694 bytes; the PNG renders two boxes joined by the labelled arrow |

Self-contained Copy mode holds: the whole flow ran with no fork checkout on disk.

**Method note.** A first attempt split the flow across two live-server sessions and
`save_snapshot` failed with "no debuggable editor page appeared". That was the test
harness, not the product: the graph lives in the editor process and dies with the
session. Re-run as a single session, it worked. Worth knowing for anyone writing a
similar harness.

## 3. Skill discovery and isolation

`codex debug prompt-input` renders the model-visible prompt without an API call, so
it answers "does the agent actually see this skill" directly:

| Project   | Result                                                                                        |
| --------- | --------------------------------------------------------------------------------------------- |
| installed | listed, resolved from `<target>/.agents/skills/recreate-scientific-figure-in-drawio/SKILL.md` |
| control   | **not listed at all**                                                                         |

Two things worth noting. The installed project resolves the skill from the
project-local copy, not from the still-installed global plugin. And the control
project does not see it despite that global plugin — a stronger isolation result
than expected.

Claude Code discovery was **not** verified this way: there is no equivalent
zero-cost prompt-dump command, and driving a real session was out of scope here.
What was verified for Claude Code is the file layout and that `.mcp.json` carries
project-relative entries with no `cwd` key. Treat "Claude Code sees the skill" as
verified by construction, not by observation.

## 4. Update

`update.mjs --project <target>` run from the real fork checkout → exit 0.

- Manifest `sourceCommit` moved from `unknown` (the fork copy had no `.git`) to
  `ae3680479ec77be0508b3d3c4672cd8bee7c1ff6`.
- `.mcp.json` entries reported as **reused**, not rewritten.
- Verification passed again.

## 5. Uninstall

`uninstall.mjs --project <target>` → exit 0.

- Target project left with `.git/` and `README.md` only. `git status --porcelain`
  empty.
- `~/.codex/config.toml` back to sha256 `017c2bf5…`, 17893 bytes — byte-identical to
  the baseline.

## 6. Defect found: uninstall left a backup in the user's home

`~/.codex/config.toml.drawio-install.bak` survived the uninstall, and the global
pollution guard added in subtask 6 failed on it — the guard catching a real
production defect, not a test leak.

Cause: `removeBackups()` in `uninstall.mjs` built its file list from the project
root, which by definition never names the user-level config. Project-level backups
were cleaned up; the user-level one never was.

Fix: derive the cleanup list from the files `removeMcpConfig()` reports it actually
edited, which includes `~/.codex/config.toml`. Regression test added
(`uninstall removes the backup of the user-level Codex config too`).

Re-verified against the real home after the fix: backup present during install,
absent after uninstall, config sha256 unchanged, pollution guard green.

Per this task's rules the fix belongs to subtask 4 (`07-26-lifecycle-migration`),
which is already archived; it is committed here with the finding recorded rather
than re-opening the archived task.

## 7. Documentation corrected by this run

The first draft of `docs/project-local-install.md` claimed everything the installer
writes is added to `.git/info/exclude` and that `git status` stays clean. The E2E
showed `.mcp.json` and `.codex/config.toml` as untracked — the exclude block covers
only the skill directories, the manifest and the backup files.

That is the installer behaving correctly: those two files are portable and a team
may want them committed, so the choice is the user's. The documentation was wrong,
not the code, and both `docs/project-local-install.md` and
`adapters/project-local/README.md` were corrected.

## 8. Global pollution recheck (D3)

After the whole cycle:

```
$HOME/.claude/skills/recreate-scientific-figure-in-drawio   absent
$HOME/.agents/skills/recreate-scientific-figure-in-drawio   absent
$HOME/.codex/skills/recreate-scientific-figure-in-drawio    absent
$HOME/.codex/config.toml                                     no managed block, sha256 unchanged
$HOME/.codex/config.toml.drawio-install.bak                  absent
```

`npm run test:project-local` → 72 tests pass, `Global pollution check passed`.
