# MCP config writers — verification

Run 2026-07-27, Node v25.9.0, codex-cli 0.145.0, Windows 11. All Codex user-level
writes were redirected with `CODEX_HOME` into scratch directories.

## The dual-write decision is confirmed working end to end

After `install.mjs --project <p1> --platform both`, with `CODEX_HOME` pointed at a
scratch home that already contained the user's own settings:

```
$ codex mcp list
Name               Command  Args                       Cwd                                    Status
drawio-file-utils  node     ./scripts/server.mjs       …/p1/.agents/skills/…                  enabled
drawio-live        node     ./scripts/live-server.mjs  …/p1/.agents/skills/…                  enabled
my-other-server    node     x.mjs                      -                                      enabled
```

Codex parses the managed block, both servers come up `enabled`, and the user's
pre-existing `my-other-server` plus `model = "gpt-5"` survive untouched. This is the
proof the user-level half of the dual write actually delivers what the project-level
half cannot (openai/codex#13025).

## Scenario results

| #   | Scenario                                                | Result                                                                                                     |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | `--platform both --mcp project`, fresh project          | exit 0; `.mcp.json`, project `.codex/config.toml`, and user `config.toml` all written                      |
| 2   | Re-install, same project                                | exit 0, one managed block, file content unchanged                                                          |
| 3   | Second project, no `--force`                            | exit **2**, rebinding message naming both projects                                                         |
| 4   | Second project, `--force`                               | exit 0, block rebound, `warning: rebound Codex MCP servers from … to …`                                    |
| 5   | `[mcp_servers."drawio-live"]` outside the managed block | exit **2**, file byte count unchanged (55 → 55)                                                            |
| 6   | `.mcp.json` with a conflicting `drawio-live`            | exit **2**, file byte-identical, both commands printed in the error                                        |
| 7   | Same, with `--force`                                    | exit 0; conflicting entry replaced, `keep-me` and `unknownTopLevel: 42` preserved, `.mcp.json.bak` written |
| 8   | CRLF user config                                        | 16 CRLF lines, 0 bare LF — line style preserved                                                            |
| 9   | `--mcp none`                                            | no config file touched at all (unchanged from the previous subtask)                                        |

## Bug found and fixed during verification: failed install left an unrecoverable state

Scenario 3 originally left an orphaned skill directory behind. The installer assembled
the skill package (phase H) _before_ writing MCP config (phase I), so an exit-2 from
the MCP writer left a skill directory that no manifest recorded. On the next attempt
the conflict check saw an unknown same-name directory and refused — with or without
`--force`, by design. The target project was stuck.

Fix: `checkMcpConflicts()` runs every MCP writer in `dryRun + quiet` mode during the
existing "Checking for conflicts" phase, before anything is assembled. It reuses the
exact write-path logic rather than duplicating the conflict rules, so the two cannot
drift. Re-verified: scenario 3 now leaves no skill directory, and the `--force` retry
succeeds.

## Guardrail note for subtask 6: mtime is the wrong assertion

The plan called for checking that the real `~/.codex/config.toml` was untouched by
comparing mtime before and after. That check **fires false positives**: Codex rewrites
its own config during ordinary operations (the real file carries 50 `[projects.*]`
trust tables and gained an unrelated edit mid-session while every test ran under a
redirected `CODEX_HOME`).

Use precise assertions instead:

- the real config contains no `drawio-scientific-illustrator managed block`;
- `~/.codex/config.toml.bak` is not refreshed — this installer's `write()` always
  copies the target to `.bak` first, so an untouched `.bak` timestamp is positive
  evidence the writer never ran against that path. (Checked here: `.bak` still dated
  five days before this session, while `config.toml` had been rewritten by Codex.)

Both were verified manually for this subtask and should become assertions in the
subtask 6 pollution check.

## Tests

```
node --test "adapters/project-local/tests/*.test.mjs"
→ tests 46, pass 46, fail 0
```

New: `mcp-entries.test.mjs` (5), `patch-mcp-json.test.mjs` (8),
`patch-codex-config.test.mjs` (10). `npm test` still green; no local absolute paths
under `adapters/`.

## Still unverifiable

The project-level `.codex/config.toml` block uses a **relative** `cwd`
(`./.agents/skills/…`). Codex ignores project-level MCP entirely today, so this form
cannot be tested. When openai/codex#13025 is fixed, re-verify; if relative `cwd` does
not resolve against the project root, switch to an absolute path and add
`.codex/config.toml` to the git exclude block.
