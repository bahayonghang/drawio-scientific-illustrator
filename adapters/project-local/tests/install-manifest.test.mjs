import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ExitError } from "../lib/cli.mjs";
import {
  SCHEMA_VERSION,
  manifestPath,
  mergePlatforms,
  readManifest,
  writeManifest,
} from "../lib/install-manifest.mjs";
import { cleanup, makeTempDir, readFile } from "./helpers.mjs";

test("returns null when no manifest exists", () => {
  const dir = makeTempDir("manifest-none");
  assert.equal(readManifest(dir), null);
  cleanup(dir);
});

test("writes atomically and leaves no temp file behind", () => {
  const dir = makeTempDir("manifest-write");
  writeManifest(
    dir,
    { schemaVersion: SCHEMA_VERSION, platforms: {} },
    { dryRun: false },
  );

  assert.ok(fs.existsSync(manifestPath(dir)));
  const siblings = fs.readdirSync(path.dirname(manifestPath(dir)));
  assert.deepEqual(siblings, ["drawio-scientific-install.json"]);
  cleanup(dir);
});

test("dry run writes nothing", () => {
  const dir = makeTempDir("manifest-dry");
  writeManifest(dir, { schemaVersion: SCHEMA_VERSION }, { dryRun: true });
  assert.equal(fs.existsSync(manifestPath(dir)), false);
  cleanup(dir);
});

test("upgrades a v1 manifest and keeps unknown fields", () => {
  const dir = makeTempDir("manifest-v1");
  fs.mkdirSync(path.dirname(manifestPath(dir)), { recursive: true });
  fs.writeFileSync(
    manifestPath(dir),
    JSON.stringify({ schemaVersion: 1, somethingElse: 42 }),
  );

  const manifest = readManifest(dir);
  assert.equal(manifest.schemaVersion, SCHEMA_VERSION);
  assert.equal(manifest.somethingElse, 42);
  assert.deepEqual(manifest.platforms, {});
  cleanup(dir);
});

test("rejects invalid JSON without overwriting it", () => {
  const dir = makeTempDir("manifest-bad");
  fs.mkdirSync(path.dirname(manifestPath(dir)), { recursive: true });
  fs.writeFileSync(manifestPath(dir), "{ not json");

  assert.throws(
    () => readManifest(dir),
    (error) => error instanceof ExitError && error.code === 1,
  );
  assert.equal(readFile(manifestPath(dir)), "{ not json");
  cleanup(dir);
});

test("rejects a manifest from a newer installer", () => {
  const dir = makeTempDir("manifest-new");
  fs.mkdirSync(path.dirname(manifestPath(dir)), { recursive: true });
  fs.writeFileSync(
    manifestPath(dir),
    JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }),
  );

  assert.throws(
    () => readManifest(dir),
    (error) => error instanceof ExitError && error.code === 1,
  );
  cleanup(dir);
});

test("merging platforms keeps entries the current run did not touch", () => {
  const merged = mergePlatforms(
    { codex: { skillPath: "a" } },
    { claude: { skillPath: "b" } },
  );
  assert.deepEqual(Object.keys(merged).sort(), ["claude", "codex"]);
});
