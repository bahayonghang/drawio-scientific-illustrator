import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assembleSkill,
  describeInstalled,
  expectedFiles,
} from "../lib/skill-package.mjs";
import { cleanup, makeTempDir } from "./helpers.mjs";

test("assembles exactly the expected file set", () => {
  const dir = makeTempDir("assemble");
  const skillDir = path.join(
    dir,
    ".claude",
    "skills",
    "recreate-scientific-figure-in-drawio",
  );

  assembleSkill({ skillDir, dryRun: false });

  const state = describeInstalled(skillDir);
  assert.deepEqual(state.files, expectedFiles().sort());
  assert.deepEqual(state.unknownTop, []);
  cleanup(dir);
});

test("dry run creates nothing", () => {
  const dir = makeTempDir("assemble-dry");
  const skillDir = path.join(dir, "skill");

  assembleSkill({ skillDir, dryRun: true });
  assert.equal(fs.existsSync(skillDir), false);
  cleanup(dir);
});

test("replacing an existing package leaves no temp or backup directories", () => {
  const dir = makeTempDir("assemble-replace");
  const skillDir = path.join(dir, "skill");

  assembleSkill({ skillDir, dryRun: false });
  assembleSkill({ skillDir, dryRun: false });

  const siblings = fs.readdirSync(dir);
  assert.deepEqual(siblings, ["skill"]);
  cleanup(dir);
});

test("reports files the installer did not write", () => {
  const dir = makeTempDir("assemble-unknown");
  const skillDir = path.join(dir, "skill");

  assembleSkill({ skillDir, dryRun: false });
  fs.writeFileSync(path.join(skillDir, "NOTES.md"), "user content");

  const state = describeInstalled(skillDir);
  assert.deepEqual(state.unknownTop, ["NOTES.md"]);
  cleanup(dir);
});

test("describes a missing directory as absent", () => {
  const dir = makeTempDir("assemble-absent");
  const state = describeInstalled(path.join(dir, "nope"));
  assert.equal(state.exists, false);
  assert.deepEqual(state.files, []);
  cleanup(dir);
});
