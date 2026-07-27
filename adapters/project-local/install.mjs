import { execFileSync } from "node:child_process";
import path from "node:path";

import { BACKUP_SUFFIX } from "./lib/backup.mjs";
import { ExitError, log, parseArgs, renderUsage, runMain } from "./lib/cli.mjs";
import { applyExcludeBlock } from "./lib/git-exclude.mjs";
import {
  MANIFEST_RELATIVE,
  SCHEMA_VERSION,
  mergePlatforms,
  readManifest,
  writeManifest,
} from "./lib/install-manifest.mjs";
import { assembleSkill, describeInstalled } from "./lib/skill-package.mjs";
import { assertSourcesPresent, relativePosix, repoRoot } from "./lib/paths.mjs";
import {
  resolvePlatforms,
  skillDirFor,
  skillRelativePath,
} from "./lib/platform.mjs";
import { resolveProjectRoot } from "./lib/project-root.mjs";
import {
  checkMcpConflicts,
  codexProjectConfigPath,
  writeMcpConfig,
} from "./lib/mcp.mjs";
import { assertMigrationRequest, removeGlobalPlugin } from "./lib/migrate.mjs";
import { userConfigPath } from "./lib/patch-codex-config.mjs";
import { verifyInstall } from "./lib/verify-install.mjs";

const SPEC = {
  project: {
    type: "string",
    required: true,
    describe: "Target project directory",
  },
  platform: {
    type: "string",
    default: "auto",
    choices: ["claude", "codex", "both", "auto"],
    describe: "Which agent platform to install for",
  },
  mcp: {
    type: "string",
    default: "project",
    choices: ["project", "none"],
    describe: "MCP config scope",
  },
  "mcp-path-style": {
    type: "string",
    default: "relative",
    choices: ["relative", "absolute"],
    describe: "How .mcp.json refers to the server scripts (Claude Code only)",
  },
  "track-in-git": {
    type: "boolean",
    describe: "Do not add the skill directory to .git/info/exclude",
  },
  force: {
    type: "boolean",
    describe: "Overwrite content this installer previously wrote",
  },
  "migrate-from-global-plugin": {
    type: "boolean",
    describe: "After a verified install, remove the global Codex plugin",
  },
  "skip-verification": {
    type: "boolean",
    describe: "Skip the post-install checks",
  },
  "dry-run": {
    type: "boolean",
    describe: "Report planned actions without writing",
  },
  help: { type: "boolean", describe: "Show this message" },
};

const MIN_NODE_MAJOR = 22;

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(`${renderUsage("install.mjs", SPEC)}\n`);
    return;
  }

  const args = parseArgs(process.argv.slice(2), SPEC);
  const dryRun = args.dryRun;

  assertNodeVersion();
  assertSourcesPresent();

  const { root, start, isGitRepo } = resolveProjectRoot(args.project);
  log.step(`Target project: ${root}`);
  if (root !== start)
    log.info(`Resolved from ${start} by walking up to the Git root.`);
  if (!isGitRepo) log.warn("Target is not a Git repository.");

  const platforms = resolvePlatforms(args.platform, root);
  log.info(`Platforms: ${platforms.join(", ")}`);

  const migration = args.migrateFromGlobalPlugin
    ? assertMigrationRequest({
        platforms,
        skipVerification: args.skipVerification,
      })
    : null;

  const previous = readManifest(root);
  const skillDirs = new Map(
    platforms.map((platform) => [platform, skillDirFor(platform, root)]),
  );

  log.step("Checking for conflicts");
  for (const [platform, skillDir] of skillDirs) {
    checkConflict({ platform, skillDir, root, previous, force: args.force });
  }
  checkMcpConflicts({
    scope: args.mcp,
    root,
    platforms,
    skillDirs,
    manifest: previous,
    pathStyle: args.mcpPathStyle,
    force: args.force,
  });
  log.ok("no conflicts");

  log.step("Assembling skill package");
  for (const [platform, skillDir] of skillDirs) {
    assembleSkill({ skillDir, dryRun });
    log.info(`${platform}: ${relativePosix(root, skillDir)}`);
  }

  log.step("Writing MCP configuration");
  if (args.mcp === "none") log.info("--mcp none: skipping MCP configuration.");
  const mcpResult = writeMcpConfig({
    scope: args.mcp,
    root,
    platforms,
    skillDirs,
    manifest: previous,
    pathStyle: args.mcpPathStyle,
    dryRun,
    force: args.force,
  });

  const manifest = buildManifest({
    previous,
    root,
    platforms,
    mcp: args.mcp,
    pathStyle: args.mcpPathStyle,
    createdFiles: mcpResult.created,
  });

  log.step("Updating .git/info/exclude");
  applyExcludeBlock(
    root,
    excludeEntries(manifest, args.trackInGit, args.mcpPathStyle),
    {
      isGitRepo,
      dryRun,
    },
  );

  log.step("Writing install manifest");
  writeManifest(root, manifest, { dryRun });
  log.info(MANIFEST_RELATIVE);

  if (args.skipVerification || dryRun) {
    log.step("Verification skipped");
  } else {
    log.step("Verifying install");
    const { ok, problems } = await verifyInstall({
      skillDirs: [...skillDirs.values()],
    });
    if (!ok) {
      throw new ExitError(
        1,
        `Install verification failed:\n${problems.map((problem) => `  - ${problem}`).join("\n")}\nThe files were left in place; run uninstall.mjs to remove them.`,
      );
    }
    log.ok("skill package responds to tools/list");
  }

  if (migration) {
    log.step("Migrating off the global Codex plugin");
    removeGlobalPlugin({ plugin: migration, dryRun });
  }

  printSummary({ root, platforms, mcp: args.mcp, dryRun });
}

function assertNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MIN_NODE_MAJOR) {
    throw new ExitError(
      1,
      `Node ${MIN_NODE_MAJOR} or newer is required. Running ${process.versions.node}.`,
    );
  }
}

function checkConflict({ platform, skillDir, root, previous, force }) {
  const state = describeInstalled(skillDir);
  if (!state.exists) return;

  const known =
    previous?.platforms?.[platform]?.skillPath ===
    relativePosix(root, skillDir);
  if (!known) {
    throw new ExitError(
      2,
      `A skill directory already exists and this installer did not create it: ${skillDir}\nMove or remove it manually, then re-run. --force does not override this.`,
    );
  }
  if (state.unknownTop.length > 0 && !force) {
    throw new ExitError(
      2,
      `The installed skill directory contains files this installer did not write: ${skillDir}\n  ${state.unknownTop.join("\n  ")}\nRe-run with --force to replace the directory, or move those files elsewhere.`,
    );
  }
}

function excludeEntries(manifest, trackInGit, pathStyle) {
  const entries = [];
  if (!trackInGit) {
    for (const entry of Object.values(manifest.platforms))
      entries.push(`${entry.skillPath}/`);
  }
  entries.push(
    MANIFEST_RELATIVE,
    `.mcp.json${BACKUP_SUFFIX}`,
    `.codex/config.toml${BACKUP_SUFFIX}`,
  );
  if (pathStyle === "absolute") entries.push(".mcp.json");
  return entries;
}

function buildManifest({
  previous,
  root,
  platforms,
  mcp,
  pathStyle,
  createdFiles = [],
}) {
  const now = new Date().toISOString();
  const updates = {};
  for (const platform of platforms) {
    updates[platform] = {
      skillPath: skillRelativePath(platform),
      mcpConfig:
        mcp === "none"
          ? null
          : platform === "claude"
            ? ".mcp.json"
            : ".codex/config.toml",
      mcpScope: mcp,
    };
    if (mcp !== "none" && platform === "claude")
      updates[platform].mcpPathStyle = pathStyle;
    if (mcp !== "none" && platform === "codex")
      updates[platform].userMcpConfig = userConfigPath();
  }
  const platformEntries = mergePlatforms(previous?.platforms, updates);

  return {
    schemaVersion: SCHEMA_VERSION,
    installedAt: previous?.installedAt ?? now,
    updatedAt: now,
    sourceRepository: "bahayonghang/drawio-scientific-illustrator",
    sourceCommit: currentCommit(),
    sourceBranch: currentBranch(),
    projectRoot: root,
    mode: "copy",
    platforms: platformEntries,
    createdFiles: [
      ...new Set([...(previous?.createdFiles ?? []), ...createdFiles]),
    ],
    managedPaths: [
      ...Object.values(platformEntries).map((entry) => `${entry.skillPath}/`),
      MANIFEST_RELATIVE,
    ],
  };
}

function currentCommit() {
  return git(["rev-parse", "HEAD"]) ?? "unknown";
}

function currentBranch() {
  return git(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
}

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function printSummary({ root, platforms, mcp, dryRun }) {
  log.step(
    dryRun ? "Dry run complete; nothing was written" : "Install complete",
  );
  for (const platform of platforms) {
    log.info(
      `${platform}: ${path.join(root, skillRelativePath(platform).split("/").join(path.sep))}`,
    );
  }
  if (mcp === "none") {
    log.info(
      "No MCP servers were configured; the skill cannot draw until they are.",
    );
    return;
  }
  if (platforms.includes("claude")) {
    log.info(
      "Launch `claude` from the project root: .mcp.json resolves server paths against the launch directory.",
    );
  }
  if (platforms.includes("codex")) {
    log.info(
      `Codex MCP servers were written to both ${codexProjectConfigPath(root)} and ${userConfigPath()}.`,
    );
    log.info(
      "Only the user-level copy takes effect today, so Codex can be bound to one project at a time.",
    );
  }
}

runMain(main);
