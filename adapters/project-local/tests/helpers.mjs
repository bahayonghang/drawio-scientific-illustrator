import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function makeTempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `drawio-adapter-${label}-`));
}

export function makeGitRepo(label) {
  const dir = makeTempDir(label);
  execFileSync("git", ["init", "-q", dir], { stdio: "pipe" });
  return dir;
}

export function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function readFile(file) {
  return fs.readFileSync(file, "utf8");
}
