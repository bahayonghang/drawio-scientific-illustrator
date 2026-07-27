# Research — how the two platforms actually load project-local skills and MCP servers

Resolves the three open items in the parent `design.md` §4.3. Measured 2026-07-27 on
**Claude Code 2.1.220** and **codex-cli 0.145.0** (Windows 11).

Method: documentation for the contract, then an empirical probe for anything the
documentation left implicit. Probe project lived in a scratch directory with
`.codex/config.toml`, `.agents/skills/probe-skill/SKILL.md`, and a minimal MCP stdio
server that appends to a marker file the moment it is spawned.

---

## Item 1 — Claude Code `.mcp.json`: no `cwd`, no project-root anchor

Source: <https://code.claude.com/docs/en/mcp> ("Project scope", "Option 3: Add a local
stdio server", "Environment variable expansion in `.mcp.json`").

**Findings**

- `.mcp.json` lives at the project root and is intended to be committed.
- The documented stdio entry shape is `command` / `args` / `env` only. **There is no
  `cwd` key** — the word does not appear anywhere in the MCP reference page.
- The documentation never states a base directory for relative paths in `args`. The
  server is spawned as a child of Claude Code, so relative paths resolve against
  Claude Code's own working directory (the launch directory), not a guaranteed
  project root.
- `${VAR}` and `${VAR:-default}` expansion **is** supported in `command`, `args`, and
  `env`.
- `CLAUDE_PROJECT_DIR` is set **in the spawned server's environment**, not in Claude
  Code's own environment. The docs are explicit that referencing it from a
  project-scoped `.mcp.json` therefore "requires a default such as
  `${CLAUDE_PROJECT_DIR:-.}`" — i.e. it degrades to `.` at expansion time and buys
  nothing over a plain relative path. (Plugin-provided MCP configs are the exception;
  those substitute it directly.)
- Project-scoped servers require interactive approval, and in an untrusted folder the
  approval settings committed to the repo are ignored — the server sits at
  `⏸ Pending approval` until the workspace trust dialog is accepted.

**Decision for parent `design.md` §4.1** — keep project-root-relative `args`
(`.claude/skills/…/scripts/live-server.mjs`), and do **not** git-exclude `.mcp.json`.
Rationale: the relative form is the only committable option, and an absolute path
would leak a machine path into a file meant for version control. The cost is a
documented constraint: **Claude Code must be launched from the project root.** The
installer's verification step must resolve the path from the project root and say so
explicitly. Add `--mcp-path-style relative|absolute` as an escape hatch; `absolute`
additionally adds `.mcp.json` to the git exclude block.

---

## Item 2 — Codex `mcp_servers` supports `cwd`, and args resolve against it

Source: <https://learn.chatgpt.com/docs/extend/mcp?surface=cli>, plus direct
observation of the already-installed upstream global plugin.

Supported stdio keys: `command` (required), `args`, `env`, `env_vars`, `cwd`,
`startup_timeout_sec`, `tool_timeout_sec`, `enabled`, `required`, `enabled_tools`,
`disabled_tools`, `default_tools_approval_mode`.

`codex mcp list` shows the upstream global plugin registered exactly this way:

```
drawio-live        node   ./scripts/live-server.mjs   cwd=…\.codex\plugins\cache\…\1.0.0\.
drawio-file-utils  node   ./scripts/server.mjs        cwd=…\.codex\plugins\cache\…\1.0.0\.
```

So `cwd` + `./`-relative `args` is the pattern upstream already relies on, and args
resolve against `cwd`. Codex is strictly better off than Claude Code here.

---

## Item 3 — Codex project-level skills work; project-level MCP servers **do not**

### 3a. `.agents/skills/` is confirmed as the project scope ✅

`codex debug prompt-input` (renders the model-visible prompt without an API call) run
inside the probe project lists the probe skill with its full path:

```
probe-skill: Probe skill used only to verify Codex project-level skill discovery.
(file: …/scratchpad/probe1/.agents/skills/probe-skill/SKILL.md)
```

The draft plan's assertion holds. **No change needed** to the Codex skill install path
in parent `design.md` §2 / PRD R2.

### 3b. `mcp_servers` in project `.codex/config.toml` is silently ignored ❌

Three independent observations, same probe project, server declared **only** in
`<project>/.codex/config.toml`:

| Check | Result |
|---|---|
| `codex mcp get probe-server` | `Error: No MCP server named 'probe-server' found.` |
| `codex mcp list` | lists only user-level servers (global drawio plugin, `node_repl`, `openaiDeveloperDocs`) |
| `codex exec "…"` in the project | completed normally, **marker file never created** — the server was never spawned |
| same, with `-c projects.'<path>'.trust_level="trusted"` | **marker file still never created** |

The marker mechanism itself was verified working by piping an `initialize` request to
the probe server by hand — it wrote the marker immediately. So the negative result is
real, not a broken probe.

`codex mcp add` has no `--scope` flag; it writes to `~/.codex/config.toml` only.

This matches the open upstream bug
[openai/codex#13025](https://github.com/openai/codex/issues/13025) ("Codex Desktop
ignores project `.codex/config.toml` MCP server … only loads `~/.codex/config.toml`"),
reported against 0.104.0 and still reproducing on 0.145.0. Trust gating is **not** the
cause.

**Consequence: the Codex half of "self-contained project-local install" cannot be
delivered as specified.** The skill installs project-locally and is discovered; its
two MCP servers cannot be registered project-locally. Parent PRD R2 and `design.md`
§4.2 need a decision from the user — see the options written into the parent task.

---

## Sources

- [Claude Code — Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Codex — Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [openai/codex#13025 — Codex ignores project `.codex/config.toml` MCP server](https://github.com/openai/codex/issues/13025)
- [openai/codex#16439 — Add `codex mcp enable|disable` subcommands](https://github.com/openai/codex/issues/16439)
- [Codex CLI Configuration Reference: Precedence, All Keys and Inline Overrides](https://codex.danielvaughan.com/2026/04/08/codex-cli-configuration-reference/)
