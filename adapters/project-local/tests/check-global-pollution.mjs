// Backstop for the test suite: every test redirects HOME-scoped writes into a
// temp directory, and this asserts that the redirection actually held. Run it
// after `node --test`, not as a test file — file execution order inside the
// runner is not something to depend on.
//
// Deliberately reads the real os.homedir() and ignores CODEX_HOME. Nothing here
// needs a baseline snapshot: every assertion is an absolute post-condition.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readManagedProject } from "../lib/patch-codex-config.mjs";

const SKILL = "recreate-scientific-figure-in-drawio";
// Match the block sentinel, not the plugin name: a globally installed Codex
// plugin legitimately mentions "drawio-scientific-illustrator" in the same
// file, and a substring search reports that as pollution.
const BLOCK_SENTINEL = /^# >>> drawio-scientific-illustrator managed block$/m;
const BACKUP_SUFFIX = ".drawio-install.bak";

const home = os.homedir();
const problems = [];

for (const parent of [".claude", ".agents", ".codex"]) {
  const dir = path.join(home, parent, "skills", SKILL);
  if (fs.existsSync(dir)) {
    problems.push(`a test installed a skill into the real home: ${dir}`);
  }
}

const realCodexConfig = path.join(home, ".codex", "config.toml");
if (fs.existsSync(realCodexConfig)) {
  const text = fs.readFileSync(realCodexConfig, "utf8");
  const bound = readManagedProject(realCodexConfig);
  if (BLOCK_SENTINEL.test(text) || bound !== null) {
    problems.push(
      `the real Codex config carries our managed block${bound ? ` bound to ${bound}` : ""}: ${realCodexConfig}`,
    );
  }
}

// Our writer copies <file> to <file>.drawio-install.bak before every write.
// That suffix is ours alone — Codex uses a plain .bak for its own backups — so
// the absence of this file is positive evidence the writer never ran here.
// Stronger than comparing mtimes on a file Codex also rewrites on its own.
const ourBackup = `${realCodexConfig}${BACKUP_SUFFIX}`;
if (fs.existsSync(ourBackup)) {
  problems.push(`our config writer ran against the real home: ${ourBackup}`);
}

if (problems.length > 0) {
  process.stderr.write("Global pollution check failed:\n");
  for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
  process.stderr.write(
    "\nA test wrote outside its temp fixture. Check that it sets CODEX_HOME.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `Global pollution check passed (home: ${path.basename(home)}).\n`,
);
