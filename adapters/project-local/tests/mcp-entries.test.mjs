import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { SERVER_NAMES, entriesEqual, entriesFor } from "../lib/mcp-entries.mjs";

const root = path.join(path.sep, "projects", "demo");
const claudeSkill = path.join(
  root,
  ".claude",
  "skills",
  "recreate-scientific-figure-in-drawio",
);
const codexSkill = path.join(
  root,
  ".agents",
  "skills",
  "recreate-scientific-figure-in-drawio",
);

test("claude relative entries carry no cwd and use posix separators", () => {
  const entries = entriesFor({
    platform: "claude",
    root,
    skillDir: claudeSkill,
  });
  assert.deepEqual(
    entries.map((entry) => entry.name),
    SERVER_NAMES,
  );
  assert.equal(entries[0].cwd, undefined);
  assert.equal(
    entries[0].args[0],
    ".claude/skills/recreate-scientific-figure-in-drawio/scripts/live-server.mjs",
  );
  assert.equal(
    entries[1].args[0],
    ".claude/skills/recreate-scientific-figure-in-drawio/scripts/server.mjs",
  );
});

test("claude absolute entries use the full skill path", () => {
  const entries = entriesFor({
    platform: "claude",
    root,
    skillDir: claudeSkill,
    pathStyle: "absolute",
  });
  assert.equal(entries[0].args[0].endsWith("/scripts/live-server.mjs"), true);
  assert.equal(entries[0].args[0].includes("\\"), false);
});

test("codex project entries use a relative cwd", () => {
  const entries = entriesFor({
    platform: "codex",
    root,
    skillDir: codexSkill,
    absolute: false,
  });
  assert.equal(
    entries[0].cwd,
    "./.agents/skills/recreate-scientific-figure-in-drawio",
  );
  assert.equal(entries[0].args[0], "./scripts/live-server.mjs");
});

test("codex user entries use an absolute cwd with forward slashes", () => {
  const entries = entriesFor({
    platform: "codex",
    root,
    skillDir: codexSkill,
    absolute: true,
  });
  assert.equal(entries[0].cwd.includes("\\"), false);
  assert.equal(
    entries[0].cwd.endsWith(
      "/.agents/skills/recreate-scientific-figure-in-drawio",
    ),
    true,
  );
});

test("equality compares command, args and cwd", () => {
  const base = { command: "node", args: ["a.mjs"], cwd: "/x" };
  assert.equal(entriesEqual(base, { ...base }), true);
  assert.equal(entriesEqual(base, { ...base, cwd: "/y" }), false);
  assert.equal(entriesEqual(base, { ...base, args: ["b.mjs"] }), false);
  assert.equal(entriesEqual(base, { ...base, command: "python" }), false);
  assert.equal(
    entriesEqual({ command: "node", args: [] }, { command: "node", args: [] }),
    true,
  );
});
