# Project-local adapter

Installs the Draw.io Scientific Illustrator skill and its two MCP servers **into a
single project directory**, self-contained, for Claude Code and Codex.

This directory is tooling for the fork. It is not part of the shipped plugin, and
nothing here is copied into the target project — only the assembled skill package
is. For a task-oriented walkthrough, read
[`docs/project-local-install.md`](../../docs/project-local-install.md); this file is
the CLI reference.

## What gets installed

| Path in the target project                             | Written for | Contents                                                                             |
| ------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------ |
| `.claude/skills/recreate-scientific-figure-in-drawio/` | Claude Code | `SKILL.md`, `agents/openai.yaml`, `scripts/{live-server,server,drawio-path}.mjs`     |
| `.agents/skills/recreate-scientific-figure-in-drawio/` | Codex       | the same five files, an independent copy                                             |
| `.mcp.json`                                            | Claude Code | `drawio-live` and `drawio-file-utils` entries                                        |
| `.codex/config.toml`                                   | Codex       | a managed block with the same two servers                                            |
| `~/.codex/config.toml`                                 | Codex       | the same managed block — see [Codex caveat](#codex-only-loads-the-user-level-config) |
| `.agents/drawio-scientific-install.json`               | both        | the install manifest                                                                 |
| `.git/info/exclude`                                    | both        | a managed block covering the skill directories, the manifest and the backup files    |

The five source files are copied verbatim from
`plugins/drawio-scientific-illustrator/`. The installer never keeps a second copy in
this repository; it assembles the package at install time.

`.mcp.json` and `.codex/config.toml` are **not** excluded. They are small and
portable, and some projects will want them committed, so that decision is left to
you — expect them as untracked files after a fresh install. The exception is
`--mcp-path-style absolute`, which makes `.mcp.json` machine-specific and therefore
excluded.

## Commands

All three commands take `--project` and `--dry-run`, and use the same exit codes:

| Exit | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| `0`  | success                                                      |
| `1`  | bad arguments, wrong environment, or a failed verification   |
| `2`  | a conflict that needs a human decision — nothing was written |

### `install.mjs`

```bash
node adapters/project-local/install.mjs --project <Project> --platform both
```

| Option                                 | Default    | Effect                                                                                                                  |
| -------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--project <dir>`                      | required   | Target project. Walks up to the Git root if `<dir>` is nested inside one.                                               |
| `--platform claude\|codex\|both\|auto` | `auto`     | `auto` detects `.claude/` for Claude Code and `.codex/` or `.agents/` for Codex, and fails if it finds neither.         |
| `--mcp project\|none`                  | `project`  | `none` installs the skill without configuring any MCP server. The skill cannot draw until they are configured.          |
| `--mcp-path-style relative\|absolute`  | `relative` | Claude Code only. See [launch directory](#claude-code-resolves-mcpjson-against-the-launch-directory).                   |
| `--track-in-git`                       | off        | Do **not** add the skill directory to `.git/info/exclude`. Use this when you want the skill committed with the project. |
| `--force`                              | off        | Replace content this installer previously wrote. It does not override a foreign directory of the same name.             |
| `--migrate-from-global-plugin`         | off        | After the install verifies, remove the global Codex plugin. Codex only.                                                 |
| `--skip-verification`                  | off        | Skip the post-install `tools/list` check.                                                                               |
| `--dry-run`                            | off        | Report every planned action, write nothing.                                                                             |

Verification spawns both installed servers and asserts `tools/list` returns a
non-empty list. It does not start draw.io, so it proves the package is complete and
runnable — not that drawing works.

### `update.mjs`

```bash
node adapters/project-local/update.mjs --project <Project>
```

Re-assembles the package from the current fork checkout into a temporary directory,
then swaps it in atomically; a failure restores the previous directory. The manifest
decides which platforms to update and reuses the MCP scope and path style recorded
at install time.

| Option                | Effect                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `--pull-source`       | Fast-forward the fork checkout first. Refuses a dirty worktree or a non-`dev` branch, and never rebases or forces.   |
| `--force`             | Replace a skill directory containing files the installer did not write. Without it, update exits `2` and lists them. |
| `--skip-verification` | Skip the post-update check.                                                                                          |

### `uninstall.mjs`

```bash
node adapters/project-local/uninstall.mjs --project <Project>
```

Manifest-driven: it removes only paths the manifest records. A skill directory
containing unrecognised files is **left in place** and reported, not deleted.

| Option                                 | Default | Effect                                             |
| -------------------------------------- | ------- | -------------------------------------------------- |
| `--remove-platform claude\|codex\|all` | `all`   | Remove one platform and leave the other installed. |

An MCP config file is deleted only when the managed entries were the last thing in
it **and** the manifest records that this installer created it. A config file you
already had is emptied of our entries and kept.

## Two platform caveats worth knowing before you install

### Claude Code resolves `.mcp.json` against the launch directory

`.mcp.json` has no `cwd` key, so relative `args` paths resolve against wherever
`claude` was started — not against the project root. **Start `claude` from the
project root.** If you cannot, install with `--mcp-path-style absolute`; the
installer then writes absolute paths and adds `.mcp.json` to `.git/info/exclude`,
since those paths are specific to your machine.

### Codex only loads the user-level config

As of codex-cli 0.145.0, project-level `mcp_servers` entries are ignored entirely
([openai/codex#13025](https://github.com/openai/codex/issues/13025)). The installer
writes both the project file (correct, and ready for when the bug is fixed) and the
user file (what actually works today).

The practical consequence: **Codex can be bound to one project at a time.**
Installing into a second project detects the existing binding and exits `2` rather
than silently rebinding. `--force` rebinds deliberately.

If the global Codex plugin is still installed, it registers servers with the same
two names. The installer reports this and suggests either
`--migrate-from-global-plugin` or `--mcp none` — see
[`docs/migration-from-global-plugin.md`](../../docs/migration-from-global-plugin.md).

## Safety rules

- Every config file is backed up to `<file>.drawio-install.bak` before a write.
- Writes go to a temp file and are renamed into place.
- A server name defined outside our managed block is never touched — the installer
  exits `2` instead.
- An MCP entry that already matches what we would write is reused, and the file is
  left byte-identical.
- A skill directory this installer did not create is never overwritten, with or
  without `--force`.

## Troubleshooting

| Symptom                                                         | Cause                                                     | Fix                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Exit `2`, "already exists and this installer did not create it" | A directory of the same name is already there             | Move it aside. `--force` deliberately does not cover this.                    |
| Exit `2`, "defined outside the block"                           | You have your own `drawio-live` server                    | Rename yours, or install with `--mcp none`.                                   |
| Exit `2`, "bound to <other project>"                            | Codex is already bound elsewhere                          | Uninstall there first, or `--force` to rebind.                                |
| Servers do not appear in Claude Code                            | `claude` was started outside the project root             | Restart from the project root, or reinstall with `--mcp-path-style absolute`. |
| Servers do not appear in Codex                                  | Codex caches config at session start                      | Start a new Codex session, then `codex mcp list`.                             |
| Verification fails                                              | Node is older than 22, or the fork checkout is incomplete | Check `node --version`; re-run from a complete checkout.                      |

## Development

```bash
npm run test:project-local
```

Runs the adapter test suite and then a guard asserting that nothing was written into
your real home directory. See
[`../../README.dev.md`](../../README.dev.md) for fork-wide conventions.
