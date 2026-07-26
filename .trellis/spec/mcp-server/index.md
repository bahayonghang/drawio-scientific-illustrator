# MCP Server Development Guidelines

> Conventions for the two hand-rolled MCP stdio servers that make up this plugin.
> This layer replaces the `frontend` scaffolding from `trellis init` — this project
> has no frontend; the product is a Codex plugin marketplace shipping Node.js
> MCP servers that drive draw.io Desktop.

---

## Guidelines Index

| Guide                                           | Description                                                  |
| ----------------------------------------------- | ------------------------------------------------------------ |
| [Directory Structure](./directory-structure.md) | Repo layout, shipped vs repo-only files, naming              |
| [Server Guidelines](./server-guidelines.md)     | JSON-RPC/stdio protocol patterns both servers follow         |
| [Tool Guidelines](./tool-guidelines.md)         | How MCP tools are named, schema'd, and dispatched            |
| [Coding Style](./coding-style.md)               | ESM/.mjs style, error messages, allowed language features    |
| [Quality Guidelines](./quality-guidelines.md)   | Tests, validation gotchas, version bumps, forbidden patterns |

---

## The one constraint that shapes everything

**Zero dependencies, deliberately.** No npm packages, no lockfile, no build step,
no test framework, no lint/format tooling. The servers implement newline-delimited
JSON-RPC over stdio by hand (`plugins/drawio-scientific-illustrator/scripts/live-server.mjs`,
`plugins/drawio-scientific-illustrator/scripts/server.mjs`). Do **not** add
`@modelcontextprotocol/sdk`, a test runner, prettier/eslint, or any package
unless explicitly asked.

---

**Language**: All documentation should be written in **English**.
