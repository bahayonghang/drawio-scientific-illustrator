// The install matrix from the task PRD, rows 1-8. Rows 9 (update) and 10
// (uninstall) live in lifecycle.test.mjs and are not duplicated here.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  cleanup,
  commitAll,
  makeGitRepo,
  makeTempDir,
  readFile,
  runCli,
} from "./helpers.mjs";

const SKILL = "recreate-scientific-figure-in-drawio";
const PACKAGE_FILES = [
  "SKILL.md",
  path.join("agents", "openai.yaml"),
  path.join("scripts", "live-server.mjs"),
  path.join("scripts", "server.mjs"),
  path.join("scripts", "drawio-path.mjs"),
];

const SKILL_DIRS = {
  claude: path.join(".claude", "skills", SKILL),
  codex: path.join(".agents", "skills", SKILL),
};

function seededRepo(label) {
  const dir = makeGitRepo(label);
  fs.writeFileSync(path.join(dir, "README.md"), "hello\n");
  commitAll(dir);
  return dir;
}

function install(root, args, codexHome) {
  return runCli("install.mjs", ["--project", root, ...args], { codexHome });
}

function assertPackage(root, platform) {
  const dir = path.join(root, SKILL_DIRS[platform]);
  for (const file of PACKAGE_FILES) {
    assert.equal(
      fs.existsSync(path.join(dir, file)),
      true,
      `${platform}: missing ${file}`,
    );
  }
}

function manifestOf(root) {
  return JSON.parse(
    readFile(path.join(root, ".agents", "drawio-scientific-install.json")),
  );
}

function claudeConfig(root) {
  return path.join(root, ".mcp.json");
}

// --- row 1 -------------------------------------------------------------------

test("new Git project, claude, mcp project", () => {
  const root = seededRepo("m1");
  const codexHome = makeTempDir("m1-codex");

  const result = install(root, ["--platform", "claude"], codexHome);
  assert.equal(result.status, 0, result.stderr);

  assertPackage(root, "claude");
  assert.equal(fs.existsSync(path.join(root, SKILL_DIRS.codex)), false);

  const config = JSON.parse(readFile(claudeConfig(root)));
  assert.deepEqual(Object.keys(config.mcpServers).sort(), [
    "drawio-file-utils",
    "drawio-live",
  ]);
  // Claude Code resolves .mcp.json paths against the launch directory, so the
  // entry must stay project-relative and free of a cwd key.
  assert.equal(config.mcpServers["drawio-live"].cwd, undefined);
  assert.match(config.mcpServers["drawio-live"].args[0], /^\.claude\/skills\//);

  assert.deepEqual(Object.keys(manifestOf(root).platforms), ["claude"]);
  assert.match(
    readFile(path.join(root, ".git", "info", "exclude")),
    /\.claude\/skills\//,
  );

  cleanup(root);
  cleanup(codexHome);
});

// --- row 2 -------------------------------------------------------------------

test("new Git project, codex, mcp project", () => {
  const root = seededRepo("m2");
  const codexHome = makeTempDir("m2-codex");

  const result = install(root, ["--platform", "codex"], codexHome);
  assert.equal(result.status, 0, result.stderr);

  assertPackage(root, "codex");
  assert.equal(fs.existsSync(path.join(root, SKILL_DIRS.claude)), false);

  const projectToml = readFile(path.join(root, ".codex", "config.toml"));
  assert.match(projectToml, /\[mcp_servers\."drawio-live"\]/);

  // Codex ignores project-level mcp_servers today, so the user-level copy is
  // the one that actually works. Both must be written.
  const userToml = readFile(path.join(codexHome, "config.toml"));
  assert.match(userToml, /\[mcp_servers\."drawio-file-utils"\]/);
  assert.match(userToml, new RegExp(`cwd = ".*${SKILL}"`));

  assert.deepEqual(Object.keys(manifestOf(root).platforms), ["codex"]);

  cleanup(root);
  cleanup(codexHome);
});

// --- row 3 -------------------------------------------------------------------

test("new Git project, both, mcp project, two independent copies", () => {
  const root = seededRepo("m3");
  const codexHome = makeTempDir("m3-codex");

  const result = install(root, ["--platform", "both"], codexHome);
  assert.equal(result.status, 0, result.stderr);

  assertPackage(root, "claude");
  assertPackage(root, "codex");

  // Self-contained copy, not a link: editing one must not affect the other.
  const claudeSkill = path.join(root, SKILL_DIRS.claude, "SKILL.md");
  const codexSkill = path.join(root, SKILL_DIRS.codex, "SKILL.md");
  assert.notEqual(fs.statSync(claudeSkill).ino, 0);
  fs.appendFileSync(claudeSkill, "\nlocal edit\n");
  assert.equal(readFile(codexSkill).includes("local edit"), false);

  assert.deepEqual(Object.keys(manifestOf(root).platforms).sort(), [
    "claude",
    "codex",
  ]);
  assert.equal(fs.existsSync(claudeConfig(root)), true);
  assert.equal(fs.existsSync(path.join(root, ".codex", "config.toml")), true);

  cleanup(root);
  cleanup(codexHome);
});

// --- row 4 -------------------------------------------------------------------

test("non-Git project, claude, installs without inventing a Git directory", () => {
  const root = makeTempDir("m4");
  const codexHome = makeTempDir("m4-codex");

  const result = install(root, ["--platform", "claude"], codexHome);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /not a Git repository/);

  assertPackage(root, "claude");
  assert.equal(fs.existsSync(path.join(root, ".git")), false);

  cleanup(root);
  cleanup(codexHome);
});

// --- row 5 -------------------------------------------------------------------

test("reinstalling over an existing install is idempotent", () => {
  const root = seededRepo("m5");
  const codexHome = makeTempDir("m5-codex");

  assert.equal(install(root, ["--platform", "both"], codexHome).status, 0);
  const before = {
    mcp: readFile(claudeConfig(root)),
    projectToml: readFile(path.join(root, ".codex", "config.toml")),
    userToml: readFile(path.join(codexHome, "config.toml")),
    exclude: readFile(path.join(root, ".git", "info", "exclude")),
    skill: readFile(path.join(root, SKILL_DIRS.claude, "SKILL.md")),
  };
  const firstManifest = manifestOf(root);

  const second = install(root, ["--platform", "both"], codexHome);
  assert.equal(second.status, 0, second.stderr);

  assert.equal(readFile(claudeConfig(root)), before.mcp);
  assert.equal(
    readFile(path.join(root, ".codex", "config.toml")),
    before.projectToml,
  );
  assert.equal(readFile(path.join(codexHome, "config.toml")), before.userToml);
  assert.equal(
    readFile(path.join(root, ".git", "info", "exclude")),
    before.exclude,
  );
  assert.equal(
    readFile(path.join(root, SKILL_DIRS.claude, "SKILL.md")),
    before.skill,
  );

  // Only the manifest is expected to move, and only its updatedAt stamp.
  const secondManifest = manifestOf(root);
  assert.equal(secondManifest.installedAt, firstManifest.installedAt);
  assert.deepEqual(secondManifest.platforms, firstManifest.platforms);

  cleanup(root);
  cleanup(codexHome);
});

// --- row 6 -------------------------------------------------------------------

test("an existing equivalent MCP entry is reused, not rewritten", () => {
  const root = seededRepo("m6");
  const codexHome = makeTempDir("m6-codex");

  // Produce the exact entries the installer would write, then hand them back to
  // it in a file that also carries a server of the user's own.
  assert.equal(install(root, ["--platform", "claude"], codexHome).status, 0);
  const generated = JSON.parse(readFile(claudeConfig(root)));

  const fresh = seededRepo("m6b");
  const withExtra = {
    mcpServers: { ...generated.mcpServers, "user-server": { command: "node" } },
  };
  fs.writeFileSync(
    claudeConfig(fresh),
    `${JSON.stringify(withExtra, null, 2)}\n`,
  );
  const original = readFile(claudeConfig(fresh));

  const result = install(fresh, ["--platform", "claude"], codexHome);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /reused existing entries/);
  assert.equal(readFile(claudeConfig(fresh)), original);

  cleanup(root);
  cleanup(fresh);
  cleanup(codexHome);
});

// --- row 7 -------------------------------------------------------------------

test("a conflicting MCP entry aborts with exit 2 and changes nothing", () => {
  const root = seededRepo("m7");
  const codexHome = makeTempDir("m7-codex");

  const conflicting = {
    mcpServers: {
      "drawio-live": { command: "node", args: ["somewhere/else.mjs"] },
    },
  };
  fs.writeFileSync(
    claudeConfig(root),
    `${JSON.stringify(conflicting, null, 2)}\n`,
  );
  const original = readFile(claudeConfig(root));

  const result = install(root, ["--platform", "claude"], codexHome);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /drawio-live/);
  assert.equal(readFile(claudeConfig(root)), original);

  // The abort happens before assembly, so no half-installed directory is left
  // behind to block the retry after the user resolves the conflict.
  assert.equal(fs.existsSync(path.join(root, SKILL_DIRS.claude)), false);

  cleanup(root);
  cleanup(codexHome);
});

// --- row 8 -------------------------------------------------------------------

test("a foreign skill directory aborts with exit 2 and is left untouched", () => {
  const root = seededRepo("m8");
  const codexHome = makeTempDir("m8-codex");

  const foreign = path.join(root, SKILL_DIRS.claude);
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, "SKILL.md"), "someone else's skill\n");

  const result = install(
    root,
    ["--platform", "claude", "--mcp", "none"],
    codexHome,
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--force does not override this/);
  assert.equal(
    readFile(path.join(foreign, "SKILL.md")),
    "someone else's skill\n",
  );

  // --force must not be an escape hatch here: the directory is not ours.
  const forced = install(
    root,
    ["--platform", "claude", "--mcp", "none", "--force"],
    codexHome,
  );
  assert.equal(forced.status, 2);
  assert.equal(
    readFile(path.join(foreign, "SKILL.md")),
    "someone else's skill\n",
  );

  cleanup(root);
  cleanup(codexHome);
});
