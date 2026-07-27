# Installer core — manual verification

Run 2026-07-27, Node v25.9.0, Windows 11. Target projects created under the session
scratchpad. All commands run from the repo root.

## Scenarios

| #   | Scenario                                | Command                                  | Result                                                                                                       |
| --- | --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Dry run, Git project                    | `--platform claude --mcp none --dry-run` | exit 0, nothing written, every write reported as `[dry-run]`                                                 |
| 2   | Real install                            | `--platform claude --mcp none`           | exit 0, 5 files assembled, manifest written, verification passed                                             |
| 3   | Re-install (idempotent)                 | same as 2                                | exit 0, `installedAt` preserved, `updatedAt` refreshed, one exclude block                                    |
| 4   | `--platform both`                       | `--platform both --mcp none`             | exit 0, two skill copies, manifest records both platforms                                                    |
| 5   | Single-platform re-install after `both` | `--platform claude --mcp none`           | exit 0, exclude block still lists **both** skill paths (built from the merged manifest, not the current run) |
| 6   | Unknown same-name skill directory       | `--platform claude --mcp none`           | exit **2**, directory untouched                                                                              |
| 7   | Same, with `--force`                    | `--platform claude --mcp none --force`   | exit **2** — `--force` does not override an unknown directory                                                |
| 8   | Non-Git project                         | `--platform codex --mcp none`            | exit 0, explicit `warning: Not a Git repository`, no exclude write                                           |
| 9   | Invalid `--platform`                    | `--platform bogus`                       | exit 1 with the allowed values                                                                               |
| 10  | Missing project path                    | `--project <missing>`                    | exit 1                                                                                                       |
| 11  | Missing `--project`                     | (omitted)                                | exit 1                                                                                                       |
| 12  | `--mcp project`                         | `--platform codex`                       | exit 1 with the "not implemented yet, use --mcp none" seam message                                           |

## Installed layout (scenario 4)

```
.agents/drawio-scientific-install.json
.agents/skills/recreate-scientific-figure-in-drawio/{SKILL.md,agents/openai.yaml,scripts/*.mjs}
.claude/skills/recreate-scientific-figure-in-drawio/{SKILL.md,agents/openai.yaml,scripts/*.mjs}
```

`.git/info/exclude` after install — the project's own rules survive verbatim:

```
my-own-rule
*.local

# >>> drawio-scientific-illustrator local install
.claude/skills/recreate-scientific-figure-in-drawio/
.agents/skills/recreate-scientific-figure-in-drawio/
.agents/drawio-scientific-install.json
.mcp.json.bak
# <<< drawio-scientific-illustrator local install
```

## Self-containment check (parent PRD acceptance criterion)

`server.mjs` was started **from the target project copy only**, with the process cwd
set to the target project and no reference to the fork checkout:

```
node .claude/skills/recreate-scientific-figure-in-drawio/scripts/server.mjs
→ initialize + tools/list
→ server.mjs tools: 9
   drawio_status, drawio_create_diagram, drawio_create_trace_document,
   drawio_write_xml, drawio_validate, drawio_inspect, drawio_update_cells,
   drawio_export, drawio_open
```

`live-server.mjs` is probed the same way by the installer's own verification step,
which reported `ok: skill package responds to tools/list` on every real install.
The copy therefore runs with no dependency on the fork checkout — the only cross-file
import in the servers is `./drawio-path.mjs`, which travels with them.

## Unit tests

```
node --test "adapters/project-local/tests/*.test.mjs"
→ tests 23, pass 23, fail 0
```

**Portability note for subtask 6:** `node --test <directory>` fails on Node 25.9.0
(`MODULE_NOT_FOUND` — it treats the directory as a test file). The quoted glob form
above is expanded by Node itself, works on both Node 22 and 25, and needs no shell
globbing, so it is safe for the Windows CI leg. Use it for the `test:project-local`
script.

## Baseline

`npm test` still green after all changes; no local absolute paths in `adapters/`.
