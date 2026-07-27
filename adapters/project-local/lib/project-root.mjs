import fs from "node:fs";
import path from "node:path";

import { ExitError } from "./cli.mjs";
import { normalize } from "./paths.mjs";

export function resolveProjectRoot(input) {
  const start = normalize(input);

  let stats;
  try {
    stats = fs.statSync(start);
  } catch (error) {
    if (error?.code === "ENOENT")
      throw new ExitError(1, `Project path does not exist: ${start}`);
    throw error;
  }
  if (!stats.isDirectory())
    throw new ExitError(1, `Project path is not a directory: ${start}`);

  try {
    fs.accessSync(start, fs.constants.W_OK);
  } catch {
    throw new ExitError(1, `Project path is not writable: ${start}`);
  }

  let current = start;
  for (;;) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return { root: current, start, isGitRepo: true };
    }
    const parent = path.dirname(current);
    if (parent === current) return { root: start, start, isGitRepo: false };
    current = parent;
  }
}

export function gitDirFor(root) {
  const marker = path.join(root, ".git");
  let stats;
  try {
    stats = fs.statSync(marker);
  } catch {
    return null;
  }
  if (stats.isDirectory()) return marker;

  const pointer = fs.readFileSync(marker, "utf8").trim();
  const match = /^gitdir:\s*(.+)$/.exec(pointer);
  if (!match) return null;
  return path.resolve(root, match[1]);
}
