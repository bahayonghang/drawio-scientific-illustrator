import path from "node:path";

import { toPosix } from "./paths.mjs";

export const SERVERS = [
  { name: "drawio-live", script: "scripts/live-server.mjs" },
  { name: "drawio-file-utils", script: "scripts/server.mjs" },
];

export const SERVER_NAMES = SERVERS.map((server) => server.name);

export function entriesFor({
  platform,
  root,
  skillDir,
  pathStyle = "relative",
  absolute = false,
}) {
  if (platform === "claude") {
    const base =
      pathStyle === "absolute"
        ? toPosix(skillDir)
        : toPosix(path.relative(root, skillDir));
    return SERVERS.map((server) => ({
      name: server.name,
      command: "node",
      args: [`${base}/${server.script}`],
    }));
  }

  const cwd = absolute
    ? toPosix(skillDir)
    : `./${toPosix(path.relative(root, skillDir))}`;
  return SERVERS.map((server) => ({
    name: server.name,
    command: "node",
    args: [`./${server.script}`],
    cwd,
  }));
}

export function entriesEqual(left, right) {
  if (!left || !right) return false;
  if (left.command !== right.command) return false;
  if ((left.cwd ?? null) !== (right.cwd ?? null)) return false;
  const a = left.args ?? [];
  const b = right.args ?? [];
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
