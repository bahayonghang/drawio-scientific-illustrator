# Design — Tests and CI for the project-local adapter

## 1. Starting point

Subtasks 2–4 already left 55 passing tests in `adapters/project-local/tests/`:

| File                          | Tests | Covers                                                                                                              |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `project-root.test.mjs`       | 6     | Git root walk-up, non-Git fallback, spaces, `.git` file, missing path, file-not-dir                                 |
| `install-manifest.test.mjs`   | 7     | create, atomic write, dry run, v1→v2 upgrade, invalid JSON, newer schema, platform merge                            |
| `git-exclude.test.mjs`        | 5     | add, replace, remove, non-Git skip, dry run                                                                         |
| `skill-package.test.mjs`      | 5     | file set, dry run, atomic replace leaves no residue, unknown files, missing dir                                     |
| `mcp-entries.test.mjs`        | 5     | Claude relative/absolute, Codex project/user, equality                                                              |
| `patch-mcp-json.test.mjs`     | 8     | create, preserve, reuse, conflict abort, `--force`, invalid JSON, dry run, removal                                  |
| `patch-codex-config.test.mjs` | 10    | create, preserve, replace, idempotent, out-of-block header abort, CRLF, BOM, project binding, removal, `CODEX_HOME` |
| `lifecycle.test.mjs`          | 9     | install→uninstall round trip, update, user-file guards, single-platform uninstall, migration guards                 |

This task closes the gaps rather than rewriting what exists.

## 2. Gaps to close

**Unit** — three holes in the PRD's list:

1. `paths.mjs` has no test file at all. The PRD asks for drive-letter
   normalization under `project-root`, but that logic lives in `paths.normalize()`.
   New `paths.test.mjs`: `~` expansion, drive-letter uppercase, `toPosix`,
   `relativePosix`, and `assertSourcesPresent` on a broken checkout.
2. `skill-package` never exercises the "source files missing" abort.
   Covered by the `assertSourcesPresent` test above.
3. `patch-codex-config` never asserts the Windows-path escaping claim. The
   writer deliberately emits forward slashes so TOML never needs backslash
   escapes; add a test that pins that, since a regression here produces a
   config that parses but points nowhere.

**Integration** — the PRD's 10-row matrix. Rows 9 and 10 (`update`, `uninstall`)
are already covered by `lifecycle.test.mjs` and will not be duplicated; the
mapping is recorded in §5 so the matrix stays auditable. Rows 1–8 become a new
`integration.test.mjs` driving the real `install.mjs` through `spawnSync`.

**Global pollution** — no check exists.

**Wiring** — no `test:project-local` / `test:all` scripts, no adapter CI job.

## 3. Global pollution check

The PRD specifies a before/after snapshot of `$HOME` skill directories plus two
assertions about the real `~/.codex/config.toml`. Two changes to that plan:

**Drop the before/after snapshot in favour of absolute post-conditions.** A
snapshot needs a baseline threaded through the whole run, and `node --test`
gives each file its own process, so no single test file can observe the suite.
The properties we actually care about are absolute and need no baseline:

1. `$HOME/{.claude,.agents,.codex}/skills/recreate-scientific-figure-in-drawio`
   does not exist.
2. The real `~/.codex/config.toml` contains no `drawio-scientific-illustrator`
   managed block.
3. `~/.codex/config.toml.drawio-install.bak` does not exist.

**Assertion 3 supersedes the PRD's `.bak` mtime comparison.** The PRD proposed
checking that `~/.codex/config.toml.bak`'s timestamp was not refreshed. That
file belongs to Codex, not to us — and since subtask 4 renamed our backup suffix
to `.drawio-install.bak` precisely to stop colliding with it, our backup now has
a name Codex will never produce. Its _absence_ is direct, baseline-free evidence
that our writer never ran against the real config. Strictly better than an mtime
comparison on a file a third party also writes.

This runs as a standalone script, `tests/check-global-pollution.mjs`, chained
after `node --test` in the npm script — not as a `*.test.mjs` file, because file
execution order inside the runner is not something to depend on. It exits 1 with
the offending paths listed.

## 4. Test command

The PRD writes `node --test adapters/project-local/tests/`. That form throws
`MODULE_NOT_FOUND` on Node 25.9.0 (the local toolchain). The portable form is a
**quoted glob**, which Node expands itself:

```
node --test "adapters/project-local/tests/*.test.mjs"
```

Verified working on Node 22 and 25, and safe under both bash and PowerShell
because the quotes stop the shell from expanding it first. The glob also
naturally excludes `helpers.mjs` and `check-global-pollution.mjs`.

## 5. Integration matrix mapping

| #   | Scenario                        | platform | mcp     | Expected                         | Where                                |
| --- | ------------------------------- | -------- | ------- | -------------------------------- | ------------------------------------ |
| 1   | New Git project                 | claude   | project | success                          | `integration.test.mjs`               |
| 2   | New Git project                 | codex    | project | success                          | `integration.test.mjs`               |
| 3   | New Git project                 | both     | project | success, two copies              | `integration.test.mjs`               |
| 4   | Non-Git project                 | claude   | project | success, no exclude block        | `integration.test.mjs`               |
| 5   | Reinstall                       | both     | project | idempotent                       | `integration.test.mjs`               |
| 6   | Equivalent MCP entry present    | claude   | project | reused, file untouched           | `integration.test.mjs`               |
| 7   | Conflicting MCP entry present   | claude   | project | exit 2                           | `integration.test.mjs`               |
| 8   | Foreign skill directory present | claude   | none    | exit 2                           | `integration.test.mjs`               |
| 9   | After update                    | both     | project | atomic replace, commit refreshed | `lifecycle.test.mjs` + new assertion |
| 10  | Uninstall                       | both     | project | no residue                       | `lifecycle.test.mjs`                 |

Row 9's "commit refreshed" is not currently asserted anywhere — `update.mjs`
rewrites `sourceCommit`/`updatedAt` but no test pins it. Added to
`lifecycle.test.mjs` rather than duplicating an install cycle.

Every scenario runs `install.mjs` as a child process with `CODEX_HOME` pointed
at a temp directory, so the Codex user-level write (which is real, and is the
only one Codex honours today) lands in the fixture.

## 6. CI

New `.github/workflows/project-local-adapter.yml`, separate from the existing
`ci.yml` so a plugin-validation failure and an adapter failure stay
distinguishable.

- Trigger: `push` and `pull_request` on `dev` and `main`.
- Matrix: `node-version: [22]` × `os: [ubuntu-latest, windows-latest]`.
- Steps: `npm run check` → `npm run test:project-local` → an `install.mjs
--dry-run` rehearsal against a temp directory (`shell: bash`, available on the
  Windows runner too).
- No draw.io, no CDP, no real MCP session — the smoke test in `npm test` already
  proves the servers start, and nothing in CI can drive a desktop app.

**Known risk:** the adapter has only ever run on Windows. `codex` is absent on
the runners, so `detectGlobalPlugin()` will take its "not available" path — the
path that was broken on Windows until subtask 4. The Linux job is the first real
POSIX execution of this code, and finding failures there is one of its purposes.

## 7. `validate-repo.mjs` scope (deferred decision from subtask 1)

Resolved: **extend it to the adapter.** Today it scans five shipped plugin files
for local Windows paths and credential patterns. The adapter is committed source
that gets copied into user projects, and CLAUDE.md treats a leaked local
absolute path as a CI red line. Scanning `adapters/project-local/**/*.mjs` costs
one glob and closes the gap. Test fixtures build paths from `os.tmpdir()`, so
they pass as written.

`.trellis/` stays out of scope — the research logs there intentionally record
real local paths as evidence, and they ship to nobody.
