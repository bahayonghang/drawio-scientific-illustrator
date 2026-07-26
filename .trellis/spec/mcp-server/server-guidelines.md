# Server Guidelines

> Protocol and runtime patterns both MCP servers follow. When touching one
> server, mirror the structure the other server already uses.

---

## File anatomy (both servers follow this order)

1. Shebang `#!/usr/bin/env node`, then `node:`-prefixed imports plus `drawio-path.mjs`.
2. `UPPER_SNAKE` constants: `SERVER_NAME`, `SERVER_VERSION`, `SUPPORTED_PROTOCOLS`, limits.
3. `const tools = [...]` — the full tool list with inline JSON Schemas.
4. Helper functions (`rpcError`, `rpcResult`, `toolResult`, `xmlEscape`, `setStyle`, ...).
5. `async function handleTool(name, args = {})` — one `switch` over tool names.
6. `async function handleMessage(message)` — JSON-RPC method dispatch.
7. Readline stdin loop + `uncaughtException` / `unhandledRejection` handlers.

Reference: `server.mjs:1-841`, `live-server.mjs:1-762` (paths relative to
`plugins/drawio-scientific-illustrator/scripts/`).

---

## Wire protocol

- Newline-delimited JSON-RPC 2.0 over stdio. Read with
  `createInterface({ input: process.stdin, crlfDelay: Infinity })`; write every
  response as `process.stdout.write(`${JSON.stringify(response)}\n`)`
  (`server.mjs:821-837`).
- **stdout is protocol-only.** All logging goes to stderr with a
  `[${SERVER_NAME}]` prefix — see the process-level handlers at
  `server.mjs:839-840`. Never `console.log` in a server.
- Blank input lines are ignored; unparseable lines get
  `rpcError(null, -32700, "Parse error", ...)`.

## `handleMessage` dispatch (keep this exact shape)

| Method            | Behavior                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialize`      | Echo requested `protocolVersion` if in `SUPPORTED_PROTOCOLS`, else fall back to `"2025-06-18"`. Return `capabilities: { tools: { listChanged: false } }`, `serverInfo`, and model-facing `instructions` (`server.mjs:795-806`). |
| `ping`            | `rpcResult(id, {})`                                                                                                                                                                                                             |
| `tools/list`      | `rpcResult(id, { tools })`                                                                                                                                                                                                      |
| `tools/call`      | Wrap `handleTool` in try/catch — see error contract below                                                                                                                                                                       |
| `notifications/*` | Return `null` → no response is written                                                                                                                                                                                          |
| anything else     | `rpcError(id, -32601, "Method not found: ...")`                                                                                                                                                                                 |

## Error contract (important)

Tool failures are **not** JSON-RPC errors. A throwing tool returns a normal
result with `isError: true` and payload `{ error: error.message, tool: params?.name }`
(`server.mjs:809-815`). JSON-RPC `error` objects are reserved for protocol
failures only: `-32700` parse, `-32601` method not found, `-32603` internal.

## Tool result shape

`toolResult(value)` builds `content: [{ type: "text", text: JSON.stringify(value, null, 2) }]`
and mirrors object values into `structuredContent` (`server.mjs:279-285`).
`live-server.mjs:314-322` extends it with an options bag
(`{ imageData, isError }`) to attach PNG screenshots — the two signatures
differ on purpose; copy the one from the file you are editing.

## State and side processes

- Module-level mutable state is fine and is the existing pattern: the `live`
  session object (`live-server.mjs:18-24`). Servers are single-session.
- Child processes: `spawn` for long-lived draw.io windows
  (`live-server.mjs:613`, detached + `stdio: "ignore"`), `execFileAsync` with
  explicit `timeout` and `windowsHide: true` for CLI calls (`server.mjs:677`,
  `server.mjs:716`).
- Every network/CDP wait has an explicit timeout and a human-readable failure
  message (`CdpClient.call`, `live-server.mjs:236-239`; `waitForTarget`,
  `live-server.mjs:352-365`). Never wait unbounded.
- Localhost only: CDP binds `127.0.0.1` (`live-server.mjs:607-608`), debug
  endpoints are fetched from `127.0.0.1` (`live-server.mjs:325`). Nothing may
  listen on or call external addresses.
