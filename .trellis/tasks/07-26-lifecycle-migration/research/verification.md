# Update, uninstall, migration — verification

Run 2026-07-27, Node v25.9.0, codex-cli 0.145.0, Windows 11. Every Codex user-level
write redirected with `CODEX_HOME`.

## Full lifecycle leaves nothing behind

Committed Git project → `install --platform both` → `update` → `uninstall`:

```
$ git status --porcelain
(empty)
$ find . -path ./.git -prune -o -type f -print
./README.md
$ cat $CODEX_HOME/config.toml
model = "gpt-5"
```

Project restored exactly, user's Codex config restored to its original single line.

## Scenario results

| #   | Scenario                                                | Result                                                                 |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | install → update → uninstall                            | exit 0/0/0, `git status` clean, only the original file left            |
| 2   | update after deleting `SKILL.md`                        | reassembled, exit 0                                                    |
| 3   | update with a user file in the skill dir                | exit **2**, file untouched, name printed                               |
| 4   | same, `--force`                                         | exit 0, directory replaced                                             |
| 5   | uninstall with a user file in the skill dir             | exit 0, that platform **skipped and reported**, other platform removed |
| 6   | uninstall `--remove-platform claude` after `both`       | manifest keeps `codex`, exclude block drops only the claude entry      |
| 7   | uninstall on a never-installed project                  | exit 0, `nothing to uninstall`                                         |
| 8   | update on a never-installed project                     | exit 1, `No install manifest`                                          |
| 9   | `--migrate-from-global-plugin` with `--platform claude` | exit 1, **before** anything is installed                               |
| 10  | `--migrate-from-global-plugin --skip-verification`      | exit 1                                                                 |
| 11  | migration with `codex` off PATH                         | exit 1, explicit message                                               |
| 12  | migration dry run                                       | prints the plan, removes nothing                                       |

## Three defects found and fixed during this subtask

### 1. Backup filename collided with Codex's own convention

The writers used `<file>.bak`. `~/.codex/` **already uses that name for Codex's own
backups** — the real directory holds `config.toml.bak`, `hooks.json.bak`,
`hooks.json.bak-codux-stale-…`, and dated variants. Writing there would have
overwritten a user's Codex backup, and the planned "delete our `.bak` on uninstall"
step would have deleted a file that was never ours.

Fixed: backups are now `<file>.drawio-install.bak` via `lib/backup.mjs`. Verified
after a full lifecycle: `~/.codex/config.toml.bak` still carries its original
2026-07-22 timestamp, and no `.drawio-install.bak` exists there.

### 2. Uninstall left empty config files behind

`.mcp.json` and `.codex/config.toml` survived uninstall as empty husks
(`{"mcpServers":{}}` and an empty file), so `git status` was not clean — failing the
parent acceptance criterion directly.

Fixed precisely rather than heuristically: the patchers now report `created`, install
records those paths in the manifest as `createdFiles`, and uninstall deletes a config
file only when _both_ it became empty _and_ the manifest says this installer created
it. A config file the user already had is never removed, however empty it ends up.

### 3. Codex CLI was never actually detected on Windows

`detectGlobalPlugin()` used `execFileSync("codex", …)`. On Windows `codex` is an npm
shim (`codex.cmd`), and Node 20+ refuses to execute `.cmd` without a shell
(`EINVAL`) — so detection silently returned "codex not available" every time. The
global-plugin coexistence warning introduced in the previous subtask **had never
fired on this platform**, and the migration guard would have wrongly reported a
missing CLI.

Fixed with a `runCodex()` helper that goes through `cmd /d /s /c` on win32 while still
passing arguments as a separate array — this also avoids the `DEP0190` deprecation
warning that plain `shell: true` produces. Verified:

```
detectGlobalPlugin()                    → { available: true, installed: true }
detectGlobalPlugin() with codex off PATH → { available: false, installed: false }
```

The `installed: true` result confirms the real global plugin is present and was simply
invisible before.

## Tests

```
node --test "adapters/project-local/tests/*.test.mjs"
→ tests 55, pass 55, fail 0
```

New `lifecycle.test.mjs` (9) drives the three CLIs as child processes with a
redirected `CODEX_HOME`, which is closer to what subtask 6's integration matrix needs
than testing the lib functions in isolation.

`npm test` green; no local absolute paths under `adapters/`.

## Guard results

- `~/.codex/config.toml` contains no managed block.
- No `~/.codex/config.toml.drawio-install.bak` exists.
- Codex's own `config.toml.bak` still dated 2026-07-22, five days before this session.
