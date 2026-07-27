import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  cleanup,
  commitAll,
  gitStatus,
  makeGitRepo,
  makeTempDir,
  runCli,
} from "./helpers.mjs";

const SKILL = "recreate-scientific-figure-in-drawio";

function seededRepo(label) {
  const dir = makeGitRepo(label);
  fs.writeFileSync(path.join(dir, "README.md"), "hello\n");
  commitAll(dir);
  return dir;
}

function claudeSkillDir(root) {
  return path.join(root, ".claude", "skills", SKILL);
}

function codexSkillDir(root) {
  return path.join(root, ".agents", "skills", SKILL);
}

test("install then uninstall leaves the project exactly as it was", () => {
  const root = seededRepo("cycle");
  const codexHome = makeTempDir("cycle-codex");

  assert.equal(
    runCli("install.mjs", ["--project", root, "--platform", "both"], {
      codexHome,
    }).status,
    0,
  );
  assert.notEqual(gitStatus(root), "");

  assert.equal(
    runCli("uninstall.mjs", ["--project", root], { codexHome }).status,
    0,
  );
  assert.equal(gitStatus(root), "");
  assert.equal(fs.existsSync(claudeSkillDir(root)), false);
  assert.equal(fs.existsSync(codexSkillDir(root)), false);
  assert.equal(fs.existsSync(path.join(root, ".mcp.json")), false);

  cleanup(root);
  cleanup(codexHome);
});

test("update reassembles an existing install", () => {
  const root = seededRepo("update");
  const codexHome = makeTempDir("update-codex");

  runCli("install.mjs", ["--project", root, "--platform", "claude"], {
    codexHome,
  });
  fs.rmSync(path.join(claudeSkillDir(root), "SKILL.md"));

  const result = runCli("update.mjs", ["--project", root], { codexHome });
  assert.equal(result.status, 0);
  assert.equal(
    fs.existsSync(path.join(claudeSkillDir(root), "SKILL.md")),
    true,
  );

  cleanup(root);
  cleanup(codexHome);
});

test("update refreshes the recorded source commit and timestamp", () => {
  const root = seededRepo("update-manifest");
  const codexHome = makeTempDir("update-manifest-codex");
  const manifestFile = path.join(
    root,
    ".agents",
    "drawio-scientific-install.json",
  );
  const read = () => JSON.parse(fs.readFileSync(manifestFile, "utf8"));

  runCli("install.mjs", ["--project", root, "--platform", "both"], {
    codexHome,
  });
  const before = read();

  assert.equal(
    runCli("update.mjs", ["--project", root], { codexHome }).status,
    0,
  );
  const after = read();

  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: path.resolve(import.meta.dirname, "..", "..", ".."),
    encoding: "utf8",
  }).trim();

  assert.equal(after.sourceCommit, head);
  assert.equal(after.installedAt, before.installedAt);
  assert.ok(
    Date.parse(after.updatedAt) > Date.parse(before.updatedAt),
    `updatedAt did not advance: ${before.updatedAt} -> ${after.updatedAt}`,
  );

  cleanup(root);
  cleanup(codexHome);
});

test("update refuses to discard files the user added, and --force allows it", () => {
  const root = seededRepo("update-user-files");
  const codexHome = makeTempDir("update-user-codex");
  runCli("install.mjs", ["--project", root, "--platform", "claude"], {
    codexHome,
  });

  const notes = path.join(claudeSkillDir(root), "MY-NOTES.md");
  fs.writeFileSync(notes, "my notes\n");

  const refused = runCli("update.mjs", ["--project", root], { codexHome });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /MY-NOTES\.md/);
  assert.equal(fs.readFileSync(notes, "utf8"), "my notes\n");

  assert.equal(
    runCli("update.mjs", ["--project", root, "--force"], { codexHome }).status,
    0,
  );
  assert.equal(fs.existsSync(notes), false);

  cleanup(root);
  cleanup(codexHome);
});

test("uninstall leaves a skill directory the user added files to", () => {
  const root = seededRepo("uninstall-user-files");
  const codexHome = makeTempDir("uninstall-user-codex");
  runCli("install.mjs", ["--project", root, "--platform", "both"], {
    codexHome,
  });

  const notes = path.join(claudeSkillDir(root), "MY-NOTES.md");
  fs.writeFileSync(notes, "my notes\n");

  const result = runCli("uninstall.mjs", ["--project", root], { codexHome });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Left in place for manual review: claude/);
  assert.equal(fs.readFileSync(notes, "utf8"), "my notes\n");
  assert.equal(fs.existsSync(codexSkillDir(root)), false);

  cleanup(root);
  cleanup(codexHome);
});

test("uninstalling one platform keeps the other installed", () => {
  const root = seededRepo("uninstall-one");
  const codexHome = makeTempDir("uninstall-one-codex");
  runCli("install.mjs", ["--project", root, "--platform", "both"], {
    codexHome,
  });

  assert.equal(
    runCli(
      "uninstall.mjs",
      ["--project", root, "--remove-platform", "claude"],
      { codexHome },
    ).status,
    0,
  );

  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, ".agents", "drawio-scientific-install.json"),
      "utf8",
    ),
  );
  assert.deepEqual(Object.keys(manifest.platforms), ["codex"]);
  assert.equal(fs.existsSync(claudeSkillDir(root)), false);
  assert.equal(fs.existsSync(codexSkillDir(root)), true);

  const exclude = fs.readFileSync(
    path.join(root, ".git", "info", "exclude"),
    "utf8",
  );
  assert.equal(exclude.includes(".claude/skills"), false);
  assert.equal(exclude.includes(".agents/skills"), true);

  cleanup(root);
  cleanup(codexHome);
});

test("uninstall is a no-op on a project that was never installed", () => {
  const root = seededRepo("uninstall-none");
  const result = runCli("uninstall.mjs", ["--project", root]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nothing to uninstall/);
  assert.equal(gitStatus(root), "");
  cleanup(root);
});

test("update refuses a project with no manifest", () => {
  const root = seededRepo("update-none");
  const result = runCli("update.mjs", ["--project", root]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /No install manifest/);
  cleanup(root);
});

test("migration is rejected for claude-only installs", () => {
  const root = seededRepo("migrate-claude");
  const result = runCli("install.mjs", [
    "--project",
    root,
    "--platform",
    "claude",
    "--migrate-from-global-plugin",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /only applies to the codex platform/);
  assert.equal(fs.existsSync(claudeSkillDir(root)), false);
  cleanup(root);
});

test("migration cannot be combined with skipped verification", () => {
  const root = seededRepo("migrate-skip");
  const result = runCli("install.mjs", [
    "--project",
    root,
    "--platform",
    "codex",
    "--migrate-from-global-plugin",
    "--skip-verification",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot be combined with --skip-verification/);
  cleanup(root);
});
