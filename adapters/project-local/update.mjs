import { execFileSync } from "node:child_process";

import { ExitError, log, parseArgs, renderUsage, runMain } from "./lib/cli.mjs";
import { SCHEMA_VERSION, writeManifest } from "./lib/install-manifest.mjs";
import { loadInstalled } from "./lib/installed.mjs";
import { writeMcpConfig } from "./lib/mcp.mjs";
import { assertSourcesPresent, repoRoot } from "./lib/paths.mjs";
import { skillDirFor } from "./lib/platform.mjs";
import { assembleSkill, describeInstalled } from "./lib/skill-package.mjs";
import { verifyInstall } from "./lib/verify-install.mjs";

const SPEC = {
  project: {
    type: "string",
    required: true,
    describe: "Target project directory",
  },
  "pull-source": {
    type: "boolean",
    describe: "Fast-forward the fork checkout before reassembling",
  },
  force: {
    type: "boolean",
    describe: "Replace a skill directory that has been edited by hand",
  },
  "skip-verification": {
    type: "boolean",
    describe: "Skip the post-update checks",
  },
  "dry-run": {
    type: "boolean",
    describe: "Report planned actions without writing",
  },
  help: { type: "boolean", describe: "Show this message" },
};

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(`${renderUsage("update.mjs", SPEC)}\n`);
    return;
  }

  const args = parseArgs(process.argv.slice(2), SPEC);
  const dryRun = args.dryRun;

  const { root, isGitRepo, manifest, platforms } = loadInstalled(args.project);
  log.step(`Target project: ${root}`);
  log.info(`Installed platforms: ${platforms.join(", ")}`);
  log.info(`Installed from commit ${manifest.sourceCommit}`);

  assertSourcesPresent();
  if (args.pullSource) pullSource({ dryRun });

  const skillDirs = new Map(
    platforms.map((platform) => [platform, skillDirFor(platform, root)]),
  );

  log.step("Checking installed packages");
  for (const [platform, skillDir] of skillDirs) {
    const state = describeInstalled(skillDir);
    if (!state.exists) {
      log.warn(`${platform}: ${skillDir} is missing; it will be reassembled.`);
      continue;
    }
    if (state.unknownTop.length > 0 && !args.force) {
      throw new ExitError(
        2,
        `The installed skill directory contains files this installer did not write: ${skillDir}\n  ${state.unknownTop.join("\n  ")}\nMove them elsewhere, or re-run with --force to replace the directory.`,
      );
    }
  }
  log.ok("safe to replace");

  log.step("Reassembling skill package");
  for (const [platform, skillDir] of skillDirs) {
    assembleSkill({ skillDir, dryRun });
    log.info(`${platform}: ${skillDir}`);
  }

  log.step("Refreshing MCP configuration");
  const scope = mcpScopeOf(manifest, platforms);
  if (scope === "none")
    log.info(
      "This install was made with --mcp none; leaving MCP configuration alone.",
    );
  writeMcpConfig({
    scope,
    root,
    platforms,
    skillDirs,
    manifest,
    pathStyle: manifest.platforms?.claude?.mcpPathStyle ?? "relative",
    force: args.force,
    dryRun,
  });

  log.step("Refreshing install manifest");
  writeManifest(
    root,
    {
      ...manifest,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      sourceCommit: git(["rev-parse", "HEAD"]) ?? manifest.sourceCommit,
      sourceBranch:
        git(["rev-parse", "--abbrev-ref", "HEAD"]) ?? manifest.sourceBranch,
      projectRoot: root,
    },
    { dryRun },
  );

  if (args.skipVerification || dryRun) {
    log.step("Verification skipped");
  } else {
    log.step("Verifying update");
    const { ok, problems } = await verifyInstall({
      skillDirs: [...skillDirs.values()],
    });
    if (!ok) {
      throw new ExitError(
        1,
        `Update verification failed:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
      );
    }
    log.ok("skill package responds to tools/list");
  }

  log.step(
    dryRun ? "Dry run complete; nothing was written" : "Update complete",
  );
  if (!isGitRepo)
    log.info("Target is not a Git repository; no exclude rules were touched.");
}

function mcpScopeOf(manifest, platforms) {
  for (const platform of platforms) {
    const scope = manifest.platforms?.[platform]?.mcpScope;
    if (scope && scope !== "none") return scope;
  }
  return "none";
}

function pullSource({ dryRun }) {
  log.step("Fast-forwarding the fork checkout");
  const status = git(["status", "--porcelain"]);
  if (status === null)
    throw new ExitError(
      1,
      `${repoRoot} is not a Git repository; cannot use --pull-source.`,
    );
  if (status !== "") {
    throw new ExitError(
      1,
      `The fork checkout has uncommitted changes; commit or stash them before using --pull-source:\n${status}`,
    );
  }

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "dev") {
    throw new ExitError(
      1,
      `--pull-source only runs on the dev branch. The fork checkout is on ${branch}.`,
    );
  }

  if (dryRun) {
    log.plan("git pull --ff-only origin dev");
    return;
  }
  try {
    execFileSync("git", ["pull", "--ff-only", "origin", "dev"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new ExitError(
      1,
      `git pull --ff-only failed:\n${error?.stderr ?? error?.message ?? error}`,
    );
  }
  log.ok(`now at ${git(["rev-parse", "HEAD"])}`);
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

runMain(main);
