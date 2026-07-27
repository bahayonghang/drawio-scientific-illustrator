import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ExitError } from "../lib/cli.mjs";
import {
  patchCodexConfig,
  readManagedProject,
  removeCodexConfig,
  userConfigPath,
} from "../lib/patch-codex-config.mjs";
import { cleanup, makeTempDir, readFile } from "./helpers.mjs";

const ENTRIES = [
  { name: "drawio-live", command: "node", args: ["./scripts/live-server.mjs"], cwd: "/skills/x" },
  { name: "drawio-file-utils", command: "node", args: ["./scripts/server.mjs"], cwd: "/skills/x" },
];

const USER_TOML = '# my own settings\nmodel = "gpt-5"\n\n[mcp_servers."my-other-server"]\ncommand = "node"\nargs = ["x.mjs"]\n';

function configFile(dir) {
  return path.join(dir, "config.toml");
}

test("writes a managed block into an empty location", () => {
  const dir = makeTempDir("codex-new");
  const file = configFile(dir);

  const result = patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });
  assert.equal(result.changed, true);

  const text = readFile(file);
  assert.match(text, /\[mcp_servers\."drawio-live"\]/);
  assert.match(text, /\[mcp_servers\."drawio-file-utils"\]/);
  cleanup(dir);
});

test("preserves existing user configuration verbatim", () => {
  const dir = makeTempDir("codex-keep");
  const file = configFile(dir);
  fs.writeFileSync(file, USER_TOML);

  patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });

  const text = readFile(file);
  assert.ok(text.startsWith(USER_TOML.trimEnd()));
  assert.match(text, /^model = "gpt-5"$/m);
  assert.match(text, /my-other-server/);
  assert.ok(fs.existsSync(`${file}.bak`));
  cleanup(dir);
});

test("replaces the block instead of appending a second one", () => {
  const dir = makeTempDir("codex-replace");
  const file = configFile(dir);

  patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });
  patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });

  const text = readFile(file);
  assert.equal((text.match(/# >>> /g) ?? []).length, 1);
  cleanup(dir);
});

test("re-running with identical content does not rewrite the file", () => {
  const dir = makeTempDir("codex-idempotent");
  const file = configFile(dir);

  patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });
  const before = readFile(file);
  const result = patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });

  assert.equal(result.changed, false);
  assert.equal(readFile(file), before);
  cleanup(dir);
});

test("refuses a managed server name defined outside the block", () => {
  const dir = makeTempDir("codex-outside");
  const file = configFile(dir);
  const original = '[mcp_servers."drawio-live"]\ncommand = "somewhere-else"\n';
  fs.writeFileSync(file, original);

  assert.throws(
    () => patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir }),
    (error) => error instanceof ExitError && error.code === 2
  );
  assert.equal(readFile(file), original);
  cleanup(dir);
});

test("preserves CRLF line endings", () => {
  const dir = makeTempDir("codex-crlf");
  const file = configFile(dir);
  fs.writeFileSync(file, '# crlf\r\nmodel = "x"\r\n');

  patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });

  const text = readFile(file);
  assert.equal(/(?<!\r)\n/.test(text), false);
  cleanup(dir);
});

test("strips a BOM instead of duplicating it", () => {
  const dir = makeTempDir("codex-bom");
  const file = configFile(dir);
  fs.writeFileSync(file, '﻿model = "x"\n');

  patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });
  assert.equal(readFile(file).startsWith("﻿"), false);
  cleanup(dir);
});

test("records the bound project and refuses to rebind without force", () => {
  const dir = makeTempDir("codex-bind");
  const other = makeTempDir("codex-bind-other");
  const file = configFile(dir);

  patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir, enforceBinding: true });
  assert.equal(readManagedProject(file).endsWith(path.basename(dir)), true);

  assert.throws(
    () => patchCodexConfig({ file, entries: ENTRIES, projectRoot: other, enforceBinding: true }),
    (error) => error instanceof ExitError && error.code === 2
  );

  const result = patchCodexConfig({ file, entries: ENTRIES, projectRoot: other, enforceBinding: true, force: true });
  assert.equal(result.rebindFrom.endsWith(path.basename(dir)), true);
  assert.equal(readManagedProject(file).endsWith(path.basename(other)), true);

  cleanup(dir);
  cleanup(other);
});

test("removing the block restores the surrounding content", () => {
  const dir = makeTempDir("codex-remove");
  const file = configFile(dir);
  fs.writeFileSync(file, USER_TOML);

  patchCodexConfig({ file, entries: ENTRIES, projectRoot: dir });
  removeCodexConfig({ file });

  assert.equal(readFile(file), USER_TOML.trimEnd() + "\n");
  assert.equal(readManagedProject(file), null);
  cleanup(dir);
});

test("userConfigPath honours CODEX_HOME so tests never touch the real config", () => {
  const previous = process.env.CODEX_HOME;
  const dir = makeTempDir("codex-home");
  process.env.CODEX_HOME = dir;

  assert.equal(userConfigPath(), path.join(dir, "config.toml"));

  delete process.env.CODEX_HOME;
  assert.equal(userConfigPath(), path.join(os.homedir(), ".codex", "config.toml"));

  if (previous === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = previous;
  cleanup(dir);
});
