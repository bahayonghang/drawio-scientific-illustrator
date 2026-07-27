import { ExitError } from "./cli.mjs";

export function writeMcpConfig({ scope }) {
  if (scope === "none") return { changed: [] };
  throw new ExitError(
    1,
    "MCP config writing is not implemented yet in this installer build. Re-run with --mcp none to install the skill only.",
  );
}

export function removeMcpConfig() {
  return { changed: [] };
}
