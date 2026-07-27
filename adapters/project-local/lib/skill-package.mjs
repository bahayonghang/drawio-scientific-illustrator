import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { ExitError, log } from "./cli.mjs";
import { SOURCE_FILES, sourceRoot, toPosix } from "./paths.mjs";

const EXPECTED_FILES = SOURCE_FILES.map((file) => toPosix(file.to));

export function expectedFiles() {
  return [...EXPECTED_FILES];
}

export function assembleSkill({ skillDir, dryRun }) {
  if (dryRun) {
    log.plan(`assemble ${EXPECTED_FILES.length} files into ${skillDir}`);
    return { written: EXPECTED_FILES };
  }

  const tmpDir = `${skillDir}.tmp-${process.pid}`;
  const backupDir = `${skillDir}.backup-${process.pid}`;
  fs.rmSync(tmpDir, { recursive: true, force: true });

  try {
    for (const file of SOURCE_FILES) {
      const target = path.join(tmpDir, file.to);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, file.from), target);
    }
    checkScripts(tmpDir);
  } catch (error) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }

  const hadPrevious = fs.existsSync(skillDir);
  fs.mkdirSync(path.dirname(skillDir), { recursive: true });
  if (hadPrevious) fs.renameSync(skillDir, backupDir);

  try {
    fs.renameSync(tmpDir, skillDir);
  } catch (error) {
    if (hadPrevious) fs.renameSync(backupDir, skillDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }

  if (hadPrevious) fs.rmSync(backupDir, { recursive: true, force: true });
  return { written: EXPECTED_FILES };
}

function checkScripts(root) {
  for (const relative of EXPECTED_FILES) {
    if (!relative.endsWith(".mjs")) continue;
    const file = path.join(root, relative);
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (error) {
      throw new ExitError(
        1,
        `Assembled script failed a syntax check: ${relative}\n${error?.stderr ?? ""}`,
      );
    }
  }
}

export function describeInstalled(skillDir) {
  if (!fs.existsSync(skillDir))
    return { exists: false, files: [], unknownTop: [] };

  const files = listFiles(skillDir, skillDir);
  const unknownTop = files.filter((file) => !EXPECTED_FILES.includes(file));
  return { exists: true, files, unknownTop };
}

function listFiles(root, current) {
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(root, absolute));
    else files.push(toPosix(path.relative(root, absolute)));
  }
  return files.sort();
}
