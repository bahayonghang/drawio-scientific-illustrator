import fs from "node:fs";
import path from "node:path";

import { backupPathFor } from "./lib/backup.mjs";
import { log, parseArgs, renderUsage, runMain } from "./lib/cli.mjs";
import { applyExcludeBlock, removeExcludeBlock } from "./lib/git-exclude.mjs";
import { manifestPath, writeManifest } from "./lib/install-manifest.mjs";
import { loadInstalled } from "./lib/installed.mjs";
import { removeMcpConfig } from "./lib/mcp.mjs";
import { skillDirFor } from "./lib/platform.mjs";
import { describeInstalled } from "./lib/skill-package.mjs";

const SPEC = {
  project: {
    type: "string",
    required: true,
    describe: "Target project directory",
  },
  "remove-platform": {
    type: "string",
    default: "all",
    choices: ["claude", "codex", "all"],
    describe: "Which platform to remove",
  },
  "dry-run": {
    type: "boolean",
    describe: "Report planned actions without writing",
  },
  help: { type: "boolean", describe: "Show this message" },
};

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(`${renderUsage("uninstall.mjs", SPEC)}\n`);
    return;
  }

  const args = parseArgs(process.argv.slice(2), SPEC);
  const dryRun = args.dryRun;

  const { root, isGitRepo, manifest, platforms } = loadInstalled(args.project, {
    required: false,
  });
  if (!manifest) {
    log.step(`Target project: ${root}`);
    log.info("No install manifest found; nothing to uninstall.");
    return;
  }

  const targets =
    args.removePlatform === "all"
      ? platforms
      : platforms.filter((platform) => platform === args.removePlatform);
  log.step(`Target project: ${root}`);
  if (targets.length === 0) {
    log.info(
      `${args.removePlatform} is not installed here; nothing to uninstall.`,
    );
    return;
  }
  log.info(`Removing: ${targets.join(", ")}`);

  const skipped = [];

  log.step("Removing skill packages");
  for (const platform of targets) {
    const skillDir = skillDirFor(platform, root);
    const state = describeInstalled(skillDir);
    if (!state.exists) {
      log.info(`${platform}: already gone`);
      continue;
    }
    if (state.unknownTop.length > 0) {
      skipped.push(platform);
      log.warn(
        `${platform}: left ${skillDir} in place — it contains files this installer did not write:\n      ${state.unknownTop.join("\n      ")}`,
      );
      continue;
    }
    if (dryRun) log.plan(`remove ${skillDir}`);
    else fs.rmSync(skillDir, { recursive: true, force: true });
    log.info(`${platform}: ${skillDir}`);
  }

  log.step("Removing MCP configuration");
  const mcpResult = removeMcpConfig({
    root,
    platforms: targets,
    createdFiles: manifest.createdFiles ?? [],
    dryRun,
  });
  removeBackups({ files: mcpResult.changed, dryRun });

  const remaining = platforms.filter(
    (platform) => !targets.includes(platform) || skipped.includes(platform),
  );

  if (remaining.length === 0) {
    log.step("Removing install manifest and exclude rules");
    removeExcludeBlock(root, { dryRun });
    if (dryRun) log.plan(`remove ${manifestPath(root)}`);
    else fs.rmSync(manifestPath(root), { force: true });
    if (!dryRun) pruneEmptyDirs(root);
  } else {
    log.step("Updating install manifest");
    const platformEntries = { ...manifest.platforms };
    for (const platform of targets) {
      if (!skipped.includes(platform)) delete platformEntries[platform];
    }
    writeManifest(
      root,
      {
        ...manifest,
        updatedAt: new Date().toISOString(),
        platforms: platformEntries,
        managedPaths: [
          ...Object.values(platformEntries).map(
            (entry) => `${entry.skillPath}/`,
          ),
          ".agents/drawio-scientific-install.json",
        ],
      },
      { dryRun },
    );
    applyExcludeBlock(
      root,
      Object.values(platformEntries).map((entry) => `${entry.skillPath}/`),
      { isGitRepo, dryRun },
    );
    log.info(`Still installed: ${remaining.join(", ")}`);
  }

  log.step(
    dryRun ? "Dry run complete; nothing was removed" : "Uninstall complete",
  );
  if (skipped.length > 0) {
    log.info(`Left in place for manual review: ${skipped.join(", ")}`);
  }
}

// Take the backup for every config file we actually edited, which includes the
// user-level ~/.codex/config.toml. Deriving the list from the project root
// missed that one and left a stray file in the user's home after uninstall.
function removeBackups({ files, dryRun }) {
  for (const config of files) {
    const backup = backupPathFor(config);
    if (!fs.existsSync(backup)) continue;
    if (dryRun) log.plan(`remove ${backup}`);
    else fs.rmSync(backup, { force: true });
  }
}

function pruneEmptyDirs(root) {
  const candidates = [
    path.join(root, ".claude", "skills"),
    path.join(root, ".claude"),
    path.join(root, ".agents", "skills"),
    path.join(root, ".agents"),
    path.join(root, ".codex"),
  ];
  for (const dir of candidates) {
    try {
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      // Directory is missing or not empty; leaving it alone is the correct outcome.
    }
  }
}

runMain(main);
