import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ExitError } from "../lib/cli.mjs";
import { SERVER_NAMES } from "../lib/mcp-entries.mjs";
import { patchMcpJson, removeMcpJson } from "../lib/patch-mcp-json.mjs";
import { cleanup, makeTempDir, readFile } from "./helpers.mjs";

const ENTRIES = [
  {
    name: "drawio-live",
    command: "node",
    args: ["skills/x/scripts/live-server.mjs"],
  },
  {
    name: "drawio-file-utils",
    command: "node",
    args: ["skills/x/scripts/server.mjs"],
  },
];

function configFile(dir) {
  return path.join(dir, ".mcp.json");
}

test("creates the file when it does not exist", () => {
  const dir = makeTempDir("mcpjson-new");
  const file = configFile(dir);

  const result = patchMcpJson({ file, entries: ENTRIES });
  assert.deepEqual(result.changed, SERVER_NAMES);

  const config = JSON.parse(readFile(file));
  assert.deepEqual(Object.keys(config.mcpServers), SERVER_NAMES);
  assert.equal(fs.existsSync(`${file}.bak`), false);
  cleanup(dir);
});

test("keeps other servers and unknown top-level fields", () => {
  const dir = makeTempDir("mcpjson-keep");
  const file = configFile(dir);
  fs.writeFileSync(
    file,
    JSON.stringify({
      mcpServers: { "keep-me": { command: "node", args: ["k.mjs"] } },
      unknownTopLevel: 42,
    }),
  );

  patchMcpJson({ file, entries: ENTRIES });

  const config = JSON.parse(readFile(file));
  assert.deepEqual(config.mcpServers["keep-me"], {
    command: "node",
    args: ["k.mjs"],
  });
  assert.equal(config.unknownTopLevel, 42);
  assert.ok(fs.existsSync(`${file}.bak`));
  cleanup(dir);
});

test("reuses an identical entry without rewriting", () => {
  const dir = makeTempDir("mcpjson-reuse");
  const file = configFile(dir);

  patchMcpJson({ file, entries: ENTRIES });
  const first = readFile(file);
  const result = patchMcpJson({ file, entries: ENTRIES });

  assert.deepEqual(result.changed, []);
  assert.deepEqual(result.reused, SERVER_NAMES);
  assert.equal(readFile(file), first);
  cleanup(dir);
});

test("refuses a conflicting entry and leaves the file byte-identical", () => {
  const dir = makeTempDir("mcpjson-conflict");
  const file = configFile(dir);
  const original = JSON.stringify(
    {
      mcpServers: { "drawio-live": { command: "python", args: ["other.py"] } },
    },
    null,
    2,
  );
  fs.writeFileSync(file, original);

  assert.throws(
    () => patchMcpJson({ file, entries: ENTRIES }),
    (error) => error instanceof ExitError && error.code === 2,
  );
  assert.equal(readFile(file), original);
  cleanup(dir);
});

test("force replaces a conflicting entry", () => {
  const dir = makeTempDir("mcpjson-force");
  const file = configFile(dir);
  fs.writeFileSync(
    file,
    JSON.stringify({
      mcpServers: { "drawio-live": { command: "python", args: ["other.py"] } },
    }),
  );

  patchMcpJson({ file, entries: ENTRIES, force: true });

  const config = JSON.parse(readFile(file));
  assert.equal(config.mcpServers["drawio-live"].command, "node");
  cleanup(dir);
});

test("refuses to overwrite invalid JSON", () => {
  const dir = makeTempDir("mcpjson-invalid");
  const file = configFile(dir);
  fs.writeFileSync(file, "{ not json");

  assert.throws(
    () => patchMcpJson({ file, entries: ENTRIES }),
    (error) => error instanceof ExitError && error.code === 1,
  );
  assert.equal(readFile(file), "{ not json");
  cleanup(dir);
});

test("dry run writes nothing", () => {
  const dir = makeTempDir("mcpjson-dry");
  const file = configFile(dir);

  patchMcpJson({ file, entries: ENTRIES, dryRun: true, quiet: true });
  assert.equal(fs.existsSync(file), false);
  cleanup(dir);
});

test("removal drops only the managed servers", () => {
  const dir = makeTempDir("mcpjson-remove");
  const file = configFile(dir);
  fs.writeFileSync(
    file,
    JSON.stringify({
      mcpServers: { "keep-me": { command: "node", args: [] } },
    }),
  );

  patchMcpJson({ file, entries: ENTRIES });
  removeMcpJson({ file, names: SERVER_NAMES });

  const config = JSON.parse(readFile(file));
  assert.deepEqual(Object.keys(config.mcpServers), ["keep-me"]);
  cleanup(dir);
});
