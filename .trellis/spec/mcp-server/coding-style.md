# Coding Style

> There is no linter or formatter in this repo — style is enforced by matching
> the existing code by hand.

---

## Formatting

- ESM `.mjs` files, 2-space indent, double quotes, semicolons.
- Core imports always use the `node:` prefix
  (`import path from "node:path"`), destructured named imports where natural
  (`import { createInterface } from "node:readline"`).
- `UPPER_SNAKE` module constants right after imports; `camelCase` functions and
  variables; `snake_case` only in wire-format keys (tool args and results).
- Long lines are tolerated (schema literals, template-string XML); don't
  reflow existing code.

## Language features (Node 22 baseline — CI pins Node 22)

The codebase freely uses: optional chaining and `??`, `.replaceAll`,
`String.raw`-free template literals for XML, `Array.prototype.toReversed`
(`server.mjs:450`), `AbortSignal.timeout` (`live-server.mjs:325`), the global
`fetch` and `WebSocket` (`live-server.mjs:211` — no `ws` package), top-level
`await` in scripts (`validate-repo.mjs:7`). Target Node 22 — don't use
features newer than it.

## Functions and structure

- Plain functions, mostly small and single-purpose. Classes are rare — the one
  example is `CdpClient` (`live-server.mjs:202`), used because it carries
  connection state. Don't introduce class hierarchies.
- Async style is `async/await` with `promisify(execFile)` for exec
  (`server.mjs:11`). Fire-and-forget failures use `.catch(() => {})` or empty
  `catch {}` blocks — only where failure is genuinely acceptable
  (`live-server.mjs:375`, `live-server.mjs:622-625`).
- **Comments are essentially absent** in the server code — the code is written
  to be self-explanatory. Don't add narrative comments; if something needs
  explanation, it belongs in a spec doc or the tool `description`.

## Error messages

- Throw plain `Error` with a complete sentence ending in a period, including
  the offending value: `` `Cell id '${patch.id}' was not found.` ``
  (`server.mjs:421`), `` `Expected a ${extension} path: ${resolved}` ``
  (`server.mjs:336`).
- Errors a user can act on include the remedy:
  `"Output already exists; pass overwrite=true to replace it: ..."`
  (`server.mjs:344`), or append `drawioInstallHint()` when draw.io itself is
  missing (`server.mjs:680`).
- Distinguish expected-missing from real failures by `error.code`:
  `if (error?.code !== "ENOENT") throw error;` (`server.mjs:346`).

## No TypeScript, no JSDoc

Plain JavaScript only. Validation happens at runtime via the JSON Schemas
(documentation for the model) plus explicit `throw`s in code — not via types.
