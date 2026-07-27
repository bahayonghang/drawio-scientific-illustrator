# Installing into a single project

The upstream plugin installs globally, for Codex only. This fork adds a second
option: put the skill and both MCP servers **inside one project directory**, working
for Claude Code and Codex, with no dependency on where this fork lives.

For the full option-by-option CLI reference, see
[`adapters/project-local/README.md`](../adapters/project-local/README.md).

## Before you start

- **Node 22 or newer.** `node --version`.
- **draw.io Desktop**, if you want to actually draw. The installer's verification
  step does not need it — it only checks that the servers start and list their
  tools — but every drawing tool does.
- **A clone of this fork.** The installer copies files out of it. After the install
  finishes you can delete the clone; the target project keeps its own copy.

## Install

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform both
```

Run it from the fork checkout, with `--project` pointing at the project you want the
skill in. Use `--platform claude` or `--platform codex` for just one.

Rehearse first if you like — `--dry-run` prints every planned action and writes
nothing:

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform both --dry-run
```

### How `--platform auto` decides

`auto` is the default. It looks inside the target project:

| Found                   | Installs for                                                    |
| ----------------------- | --------------------------------------------------------------- |
| `.claude/`              | Claude Code                                                     |
| `.codex/` or `.agents/` | Codex                                                           |
| both                    | both                                                            |
| neither                 | nothing — it exits and asks you to pass `--platform` explicitly |

A brand-new project has none of these, so the first install usually needs an explicit
`--platform`.

### What it writes

```
your-project/
├── .claude/skills/recreate-scientific-figure-in-drawio/   # Claude Code
│   ├── SKILL.md
│   ├── agents/openai.yaml
│   └── scripts/{live-server,server,drawio-path}.mjs
├── .agents/skills/recreate-scientific-figure-in-drawio/   # Codex, an independent copy
├── .mcp.json                                              # Claude Code MCP entries
├── .codex/config.toml                                     # Codex MCP entries
└── .agents/drawio-scientific-install.json                 # install manifest
```

The **skill directories and the manifest** are added to `.git/info/exclude`, so the
bulky generated files never show up in `git status`. Install with `--track-in-git`
if you want them committed — say, to share the skill with your team.

`.mcp.json` and `.codex/config.toml` are deliberately **not** excluded. They are
small, portable, and something a team may reasonably want in version control, so
that call is left to you. Expect them as untracked files after a fresh install.

(One exception: `--mcp-path-style absolute` writes machine-specific paths into
`.mcp.json`, so that file _is_ excluded in that mode.)

The same managed block is also written to your user-level `~/.codex/config.toml`.
That is not a mistake; see [the Codex limitation](#codex-can-only-be-bound-to-one-project-at-a-time).

## Verify it worked

The installer already spawned both servers and checked that they list their tools.
To confirm the agent can see them:

**Claude Code** — start a session **from the project root**:

```bash
cd /path/to/your-project
claude
```

Then ask it to list available skills; `recreate-scientific-figure-in-drawio` should
appear. `/mcp` lists the two servers.

**Codex** — start a session in the project and run:

```bash
codex mcp list
```

`drawio-live` and `drawio-file-utils` should both be listed as enabled. Codex reads
its configuration at session start, so a session that was already open will not see
them.

## Two limitations to know about

### Claude Code must be started from the project root

`.mcp.json` has no way to say "resolve this path relative to the project". Claude
Code resolves the relative `args` path against the directory `claude` was launched
from. Start it anywhere else and the servers fail to spawn.

If you need to launch from elsewhere, install with `--mcp-path-style absolute`. The
installer then writes machine-specific absolute paths and excludes `.mcp.json` from
Git, since those paths only make sense on your machine.

### Codex can only be bound to one project at a time

codex-cli 0.145.0 ignores project-level `mcp_servers` entirely
([openai/codex#13025](https://github.com/openai/codex/issues/13025)). Only the
user-level `~/.codex/config.toml` is read — which is why the installer writes both:
the project file is correct and will start working when the bug is fixed, and the
user file is what works today.

Because the user-level file is global, Codex points at whichever project was
installed last. Installing into a second project stops with an error naming the
currently bound project instead of silently rebinding. To move the binding
deliberately:

```bash
node adapters/project-local/install.mjs --project /path/to/other-project --platform codex --force
```

Claude Code has no such limitation — its config is genuinely per-project.

## When something is already there

The installer never overwrites something it did not create. It stops with exit
code `2`, changes nothing, and tells you what it found.

| Message                                                                 | What happened                                                    | What to do                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| "a skill directory already exists and this installer did not create it" | A directory with the same name is already in the project         | Move or rename it. `--force` deliberately does not cover this — the files are not ours to replace. |
| "defined outside the block"                                             | Your config already defines `drawio-live` or `drawio-file-utils` | Rename your server, or install with `--mcp none` and wire it up yourself.                          |
| "bound to `<other project>`"                                            | Codex is bound elsewhere                                         | Uninstall there, or re-run with `--force`.                                                         |

If your config already contains **exactly** the entries the installer would write,
it reuses them and leaves the file byte-identical. Re-running the installer on an
already-installed project is safe and idempotent.

## Updating

After pulling new work into the fork:

```bash
node adapters/project-local/update.mjs --project /path/to/your-project
```

It reassembles the package into a temp directory and swaps it in atomically, so a
failure leaves the working copy intact. Add `--pull-source` to fast-forward the fork
checkout first (it refuses a dirty worktree or a branch other than `dev`).

If you edited the installed skill by hand, update stops and lists your files rather
than discarding them. `--force` replaces them.

## Uninstalling

```bash
node adapters/project-local/uninstall.mjs --project /path/to/your-project
```

Removes only what the manifest records: the skill directories, our MCP entries, the
exclude block, and the manifest itself. When it finishes, `git status` in the target
project should look exactly as it did before the install.

Two deliberate exceptions:

- A skill directory containing files the installer did not write is **left in
  place** and reported. Your files are not deleted.
- A config file you already had is emptied of our entries but kept. Only a config
  file the installer created is deleted.

Remove one platform and keep the other with `--remove-platform claude` or
`--remove-platform codex`.

## Related

- [Migrating off the global Codex plugin](migration-from-global-plugin.md)
- [Syncing this fork with upstream](upstream-sync.md)
- [CLI reference](../adapters/project-local/README.md)
