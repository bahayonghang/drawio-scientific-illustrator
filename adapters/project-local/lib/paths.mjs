import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ExitError } from "./cli.mjs";

export const adapterDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const repoRoot = path.resolve(adapterDir, "..", "..");
export const sourceRoot = path.join(
  repoRoot,
  "plugins",
  "drawio-scientific-illustrator",
);

export const SKILL_NAME = "recreate-scientific-figure-in-drawio";

export const SOURCE_FILES = [
  { from: path.join("skills", SKILL_NAME, "SKILL.md"), to: "SKILL.md" },
  {
    from: path.join("skills", SKILL_NAME, "agents", "openai.yaml"),
    to: path.join("agents", "openai.yaml"),
  },
  {
    from: path.join("scripts", "live-server.mjs"),
    to: path.join("scripts", "live-server.mjs"),
  },
  {
    from: path.join("scripts", "server.mjs"),
    to: path.join("scripts", "server.mjs"),
  },
  {
    from: path.join("scripts", "drawio-path.mjs"),
    to: path.join("scripts", "drawio-path.mjs"),
  },
];

export function assertSourcesPresent() {
  const missing = SOURCE_FILES.map((file) => file.from).filter(
    (relative) => !existsSync(path.join(sourceRoot, relative)),
  );
  if (missing.length > 0) {
    throw new ExitError(
      1,
      `Source files are missing from ${sourceRoot}: ${missing.join(", ")}. Run this installer from a complete checkout of the fork.`,
    );
  }
}

export function normalize(input) {
  let expanded = input;
  if (expanded === "~") expanded = os.homedir();
  else if (expanded.startsWith("~/") || expanded.startsWith("~\\")) {
    expanded = path.join(os.homedir(), expanded.slice(2));
  }
  const resolved = path.resolve(expanded);
  if (process.platform === "win32" && /^[a-z]:/.test(resolved)) {
    return resolved[0].toUpperCase() + resolved.slice(1);
  }
  return resolved;
}

export function toPosix(input) {
  return input.split(path.sep).join("/");
}

export function relativePosix(from, to) {
  return toPosix(path.relative(from, to));
}
