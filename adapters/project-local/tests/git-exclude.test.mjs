import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { applyExcludeBlock, removeExcludeBlock } from "../lib/git-exclude.mjs";
import { cleanup, makeGitRepo, makeTempDir, readFile } from "./helpers.mjs";

function excludeFile(repo) {
  return path.join(repo, ".git", "info", "exclude");
}

test("adds a managed block and preserves existing rules", () => {
  const repo = makeGitRepo("exclude-add");
  fs.mkdirSync(path.dirname(excludeFile(repo)), { recursive: true });
  fs.writeFileSync(excludeFile(repo), "my-own-rule\n*.local\n");

  applyExcludeBlock(repo, [".claude/skills/x/"], {
    isGitRepo: true,
    dryRun: false,
  });

  const text = readFile(excludeFile(repo));
  assert.match(text, /^my-own-rule$/m);
  assert.match(text, /^\*\.local$/m);
  assert.match(text, /^\.claude\/skills\/x\/$/m);
  cleanup(repo);
});

test("replaces the block instead of appending a second one", () => {
  const repo = makeGitRepo("exclude-replace");
  applyExcludeBlock(repo, ["first/"], { isGitRepo: true, dryRun: false });
  applyExcludeBlock(repo, ["second/"], { isGitRepo: true, dryRun: false });

  const text = readFile(excludeFile(repo));
  assert.equal((text.match(/# >>> /g) ?? []).length, 1);
  assert.equal(text.includes("first/"), false);
  assert.match(text, /^second\/$/m);
  cleanup(repo);
});

test("removing the block restores the surrounding content", () => {
  const repo = makeGitRepo("exclude-remove");
  fs.mkdirSync(path.dirname(excludeFile(repo)), { recursive: true });
  fs.writeFileSync(excludeFile(repo), "keep-me\n");

  applyExcludeBlock(repo, ["gone/"], { isGitRepo: true, dryRun: false });
  removeExcludeBlock(repo, { dryRun: false });

  assert.equal(readFile(excludeFile(repo)), "keep-me\n");
  cleanup(repo);
});

test("skips a non-Git project", () => {
  const dir = makeTempDir("exclude-nogit");
  assert.equal(
    applyExcludeBlock(dir, ["x/"], { isGitRepo: false, dryRun: false }),
    false,
  );
  cleanup(dir);
});

test("dry run leaves the file untouched", () => {
  const repo = makeGitRepo("exclude-dry");
  fs.mkdirSync(path.dirname(excludeFile(repo)), { recursive: true });
  fs.writeFileSync(excludeFile(repo), "only-this\n");

  applyExcludeBlock(repo, ["x/"], { isGitRepo: true, dryRun: true });
  assert.equal(readFile(excludeFile(repo)), "only-this\n");
  cleanup(repo);
});
