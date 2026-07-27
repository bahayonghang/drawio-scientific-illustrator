import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ExitError } from "../lib/cli.mjs";
import { resolveProjectRoot } from "../lib/project-root.mjs";
import { cleanup, makeGitRepo, makeTempDir } from "./helpers.mjs";

test("resolves the Git root from a nested directory", () => {
  const repo = makeGitRepo("root");
  const nested = path.join(repo, "packages", "app");
  fs.mkdirSync(nested, { recursive: true });

  const resolved = resolveProjectRoot(nested);
  assert.equal(resolved.isGitRepo, true);
  assert.equal(fs.realpathSync(resolved.root), fs.realpathSync(repo));
  cleanup(repo);
});

test("falls back to the given directory when there is no Git root", () => {
  const dir = makeTempDir("nogit");
  const resolved = resolveProjectRoot(dir);
  assert.equal(resolved.isGitRepo, false);
  assert.equal(resolved.root, resolved.start);
  cleanup(dir);
});

test("handles a directory name containing spaces", () => {
  const parent = makeTempDir("spaces");
  const spaced = path.join(parent, "my project dir");
  fs.mkdirSync(spaced);

  const resolved = resolveProjectRoot(spaced);
  assert.equal(resolved.root, resolved.start);
  cleanup(parent);
});

test("treats a .git file as a repository marker", () => {
  const dir = makeTempDir("worktree");
  fs.writeFileSync(
    path.join(dir, ".git"),
    "gitdir: ../real/.git/worktrees/w\n",
  );

  const resolved = resolveProjectRoot(dir);
  assert.equal(resolved.isGitRepo, true);
  cleanup(dir);
});

test("rejects a missing path", () => {
  const dir = makeTempDir("missing");
  const missing = path.join(dir, "nope");
  assert.throws(
    () => resolveProjectRoot(missing),
    (error) => error instanceof ExitError && error.code === 1,
  );
  cleanup(dir);
});

test("rejects a file", () => {
  const dir = makeTempDir("file");
  const file = path.join(dir, "a.txt");
  fs.writeFileSync(file, "x");
  assert.throws(
    () => resolveProjectRoot(file),
    (error) => error instanceof ExitError && error.code === 1,
  );
  cleanup(dir);
});
