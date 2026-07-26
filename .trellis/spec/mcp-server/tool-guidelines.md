# Tool Guidelines

> How MCP tools are defined in this plugin. Every tool lives in the `tools`
> array of its server plus one `case` in that server's `handleTool` switch.

---

## Naming

- `drawio_<verb>_<noun>` in `server.mjs` (e.g. `drawio_create_diagram`,
  `drawio_update_cells`); `drawio_live_<verb>` in `live-server.mjs`
  (e.g. `drawio_live_add_shape`).
- Tool names and all argument names are `snake_case` (`output_path`,
  `step_delay_ms`, `fill_color`).

## Input schemas (hand-written JSON Schema)

Follow the existing schema discipline — it is strict everywhere:

- `additionalProperties: false` on **every** object, including nested ones
  (`server.mjs:33-140`).
- Every number gets explicit bounds: `minimum`/`maximum`/`exclusiveMinimum`
  (e.g. `font_size: { minimum: 1, maximum: 200 }`, `server.mjs:84`). Every
  array gets `maxItems` (`vertices: maxItems: 1000`, `server.mjs:62`).
- Defaults are declared in the schema (`default: 350`) **and** re-applied in
  code with `??` / `||`, because no schema validator runs at runtime
  (`live-server.mjs:596`, `server.mjs:749`).
- Shared shapes are hoisted: spread a common properties object
  (`shapeProperties`, `live-server.mjs:33-51`) or use `$defs` + `$ref`
  (`point`, `server.mjs:131-138`).
- `description` strings are full sentences written **for the model**, including
  usage guidance ("Use absolute output paths.", "Defaults to input_path for
  in-place edits.").

## Safety conventions

- Destructive file writes require `overwrite: true`, enforced via
  `assertWritable(target, overwrite)` (`server.mjs:341-349`). Destructive
  canvas operations require `confirm: true` (`drawio_live_clear`,
  `live-server.mjs:642`).
- All paths are normalized before use: `normalizeOutputPath` expands `~`,
  resolves to absolute, and checks the extension (`server.mjs:331-339`).
  Output directories are created with `fs.mkdir(..., { recursive: true })`.
- Generated XML always passes through `inspectXml` validation before being
  written (`writeValidatedXml`, `server.mjs:649-656`) — never write a .drawio
  file unvalidated.
- User-provided text is XML-escaped with the local `xmlEscape` before
  interpolation; values injected into browser-side code are serialized with
  `JSON.stringify(payload)` (`live-server.mjs:512`).

## Adding a tool (checklist)

1. Add the entry to the server's `tools` array (schema per above).
2. Add the `case` in `handleTool`; throw plain `Error` with a sentence message
   on bad input. The default case throws `Unknown tool: ${name}`.
3. Return a plain JSON-serializable object; `snake_case` keys
   (`output_path`, `patches_applied`).
4. `npm test` passes automatically (smoke test only counts tools), so actually
   exercise the new tool with the `mcp-tool-test` skill — the smoke test never
   calls tools.
