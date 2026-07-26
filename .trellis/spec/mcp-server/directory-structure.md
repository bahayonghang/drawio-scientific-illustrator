# Directory Structure

> What lives where, and which files actually ship to users.

---

## Layout

```
.
├── plugins/drawio-scientific-illustrator/   # THE PRODUCT — everything shipped lives here
│   ├── .codex-plugin/plugin.json            # Plugin manifest (name, version, interface metadata)
│   ├── .mcp.json                            # Declares the two MCP servers (drawio-live, drawio-file-utils)
│   ├── scripts/
│   │   ├── live-server.mjs                  # "drawio-live" server: drives a visible draw.io window via CDP
│   │   ├── server.mjs                       # "drawio-file-utils" server: .drawio file create/inspect/patch/export
│   │   └── drawio-path.mjs                  # Shared helper: locate the draw.io executable per-platform
│   └── skills/recreate-scientific-figure-in-drawio/
│       ├── SKILL.md                         # Shipped skill instructions
│       └── agents/openai.yaml
├── scripts/                                 # REPO VALIDATION ONLY — never shipped
│   ├── smoke-test.mjs                       # Spawns both servers, asserts tools/list is non-empty
│   └── validate-repo.mjs                    # Structure + portability checks (see quality-guidelines)
├── .agents/plugins/marketplace.json         # Tracked despite .agents/ being gitignored — required by CI
├── .github/workflows/ci.yml                 # Node 22, runs `npm test`
├── install.sh / install.ps1                 # User-facing installers
├── package.json                             # Private; only defines check/test scripts, engines >=22
└── README.md / PRIVACY.md / CHANGELOG.md    # README and PRIVACY are bilingual EN + 中文
```

---

## Rules

- **Shipped vs repo-only**: anything under `plugins/drawio-scientific-illustrator/`
  ships to users; root `scripts/` are repo validation only. Don't import between
  the two trees.
- **Server self-containment**: each server file is self-contained. The only
  shared module is `drawio-path.mjs` (imported by both servers,
  `live-server.mjs:9`, `server.mjs:9`). Helpers like `rpcError`, `xmlEscape`,
  `setStyle` are intentionally duplicated per server rather than extracted —
  keep it that way unless asked to refactor.
- **Fork caveat**: this is a fork of `icebird1998/drawio-scientific-illustrator`.
  README, installers, and `plugin.json` still reference upstream `icebird1998`
  URLs — do **not** "fix" them.
- **`.agents/`, `.claude/`, `.codex/` are gitignored**, but
  `.agents/plugins/marketplace.json` was committed earlier and is still tracked;
  `validate-repo.mjs:6` and CI require it. Never treat it as local-only.
- `drawio-project-local-skill-execution-plan.md` at the root is a non-binding
  draft, not an accepted spec.

---

## Naming

- All scripts are ESM with the `.mjs` extension; names are kebab-case
  (`live-server.mjs`, `drawio-path.mjs`, `smoke-test.mjs`).
- New docs are written in English (existing README/PRIVACY stay bilingual).
