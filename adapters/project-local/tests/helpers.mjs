import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const adapterDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function runCli(script, args, { codexHome } = {}) {
  const result = spawnSync(
    process.execPath,
    [path.join(adapterDir, script), ...args],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CODEX_HOME: codexHome ?? makeTempDir("codex-home"),
      },
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function gitStatus(dir) {
  return execFileSync("git", ["status", "--porcelain"], {
    cwd: dir,
    encoding: "utf8",
  }).trim();
}

export function commitAll(dir) {
  execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "pipe" });
  execFileSync(
    "git",
    [
      "-c",
      "user.email=t@example.com",
      "-c",
      "user.name=t",
      "commit",
      "-q",
      "-m",
      "init",
    ],
    {
      cwd: dir,
      stdio: "pipe",
    },
  );
}
