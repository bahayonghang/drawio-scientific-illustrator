import fs from "node:fs";
import path from "node:path";

import { log } from "./cli.mjs";
import { gitDirFor } from "./project-root.mjs";

const BEGIN = "# >>> drawio-scientific-illustrator local install";
const END = "# <<< drawio-scientific-illustrator local install";

function excludeFileFor(root) {
  const gitDir = gitDirFor(root);
  if (!gitDir) return null;
  return path.join(gitDir, "info", "exclude");
}

function readExisting(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function stripBlock(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf(BEGIN);
  if (start === -1) return { lines, removed: false };
  const end = lines.indexOf(END, start);
  if (end === -1) return { lines, removed: false };

  const before = lines.slice(0, start);
  while (before.length > 0 && before[before.length - 1] === "") before.pop();
  return { lines: [...before, ...lines.slice(end + 1)], removed: true };
}

export function applyExcludeBlock(root, entries, { isGitRepo, dryRun }) {
  if (!isGitRepo) {
    log.warn("Not a Git repository; skipping .git/info/exclude.");
    return false;
  }
  const file = excludeFileFor(root);
  if (!file) {
    log.warn("Cannot locate .git/info/exclude; skipping.");
    return false;
  }
  if (dryRun) {
    log.plan(
      `update managed block in ${path.relative(root, file)} (${entries.length} entries)`,
    );
    return true;
  }

  const original = readExisting(file);
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const { lines } = stripBlock(original);
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const block = [BEGIN, ...entries, END];
  const next = [...lines, ...(lines.length > 0 ? [""] : []), ...block, ""].join(
    newline,
  );

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next, "utf8");
  return true;
}

export function removeExcludeBlock(root, { dryRun }) {
  const file = excludeFileFor(root);
  if (!file || !fs.existsSync(file)) return false;
  if (dryRun) {
    log.plan(`remove managed block from ${path.relative(root, file)}`);
    return true;
  }

  const original = readExisting(file);
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const { lines, removed } = stripBlock(original);
  if (!removed) return false;

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  fs.writeFileSync(
    file,
    lines.length > 0 ? `${lines.join(newline)}${newline}` : "",
    "utf8",
  );
  return true;
}
