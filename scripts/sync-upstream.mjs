import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The fork only ever tracks these two repositories. Anything else means the
// script is pointed at a clone it was not written for, and syncing could
// rewrite history that does not belong to us.
const EXPECTED_REMOTES = {
  origin: "bahayonghang/drawio-scientific-illustrator",
  upstream: "icebird1998/drawio-scientific-illustrator",
};

const USAGE = `Usage: node scripts/sync-upstream.mjs [options]

  --no-push           Sync locally without pushing to origin
  --skip-dev-rebase   Only fast-forward main; leave dev alone
  --help              Show this message

Syncs upstream/main into main (fast-forward only), then rebases dev on main.
Never runs 'reset --hard' or a bare '--force' push, and never resolves
conflicts for you.`;

class Abort extends Error {}

function git(args, { capture = true } = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture
      ? ["ignore", "pipe", "pipe"]
      : ["ignore", "inherit", "inherit"],
  });
}

function tryGit(args) {
  try {
    return { ok: true, stdout: git(args) };
  } catch (error) {
    return {
      ok: false,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? error?.message ?? "",
    };
  }
}

function step(message) {
  process.stdout.write(`==> ${message}\n`);
}

function info(message) {
  process.stdout.write(`    ${message}\n`);
}

function parseArgs(argv) {
  const options = { noPush: false, skipDevRebase: false, help: false };
  for (const token of argv) {
    if (token === "--no-push") options.noPush = true;
    else if (token === "--skip-dev-rebase") options.skipDevRebase = true;
    else if (token === "--help" || token === "-h") options.help = true;
    else throw new Abort(`Unknown option: ${token}\n\n${USAGE}`);
  }
  return options;
}

function normalizeRemote(url) {
  return url
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.git$/, "")
    .toLowerCase();
}

function assertRemotes() {
  for (const [name, expected] of Object.entries(EXPECTED_REMOTES)) {
    const result = tryGit(["remote", "get-url", name]);
    if (!result.ok) {
      throw new Abort(
        `Remote '${name}' is not configured. Expected it to point at ${expected}.\n` +
          `  git remote add ${name} https://github.com/${expected}.git`,
      );
    }
    const url = result.stdout.trim();
    if (!normalizeRemote(url).includes(expected)) {
      throw new Abort(
        `Remote '${name}' points at ${url}, which does not look like ${expected}.\n` +
          "Refusing to sync a clone this script was not written for.",
      );
    }
    info(`${name} -> ${url}`);
  }
}

function assertBranchExists(branch) {
  if (
    !tryGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).ok
  ) {
    throw new Abort(`Local branch '${branch}' does not exist in ${root}.`);
  }
}

function currentBranch() {
  return git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  step(`Repository: ${root}`);
  if (!tryGit(["rev-parse", "--git-dir"]).ok) {
    throw new Abort(`${root} is not a git repository.`);
  }

  const startingBranch = currentBranch();
  info(`current branch: ${startingBranch}`);

  step("Checking the worktree is clean");
  const status = git(["status", "--porcelain"]).trim();
  if (status !== "") {
    throw new Abort(
      "The worktree has uncommitted changes. Commit or stash them first:\n" +
        status
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n"),
    );
  }
  info("clean");

  step("Checking remotes");
  assertRemotes();
  assertBranchExists("main");
  if (!options.skipDevRebase) assertBranchExists("dev");

  step("Fetching upstream");
  git(["fetch", "upstream", "--prune"], { capture: false });

  step("Fast-forwarding main");
  if (
    !tryGit(["rev-parse", "--verify", "--quiet", "refs/remotes/upstream/main"])
      .ok
  ) {
    throw new Abort("upstream/main does not exist after fetching.");
  }
  if (
    tryGit([
      "merge-base",
      "--is-ancestor",
      "refs/heads/main",
      "refs/remotes/upstream/main",
    ]).ok === false
  ) {
    const ahead = git([
      "rev-list",
      "--oneline",
      "refs/remotes/upstream/main..refs/heads/main",
    ]).trim();
    throw new Abort(
      "main cannot be fast-forwarded: it carries commits upstream does not have.\n" +
        (ahead === ""
          ? ""
          : `${ahead
              .split("\n")
              .map((line) => `  ${line}`)
              .join("\n")}\n`) +
        "Move that work to dev, or resolve it by hand. This script will not rewrite main.",
    );
  }

  git(["switch", "main"], { capture: false });
  git(["merge", "--ff-only", "refs/remotes/upstream/main"], { capture: false });
  info(`main is at ${git(["rev-parse", "--short", "HEAD"]).trim()}`);

  if (options.noPush) info("skipping push (--no-push)");
  else git(["push", "origin", "main"], { capture: false });

  if (options.skipDevRebase) {
    step("Skipping the dev rebase (--skip-dev-rebase)");
    if (startingBranch !== "main")
      git(["switch", startingBranch], { capture: false });
    step("Done");
    return 0;
  }

  step("Rebasing dev onto main");
  git(["switch", "dev"], { capture: false });
  const rebase = tryGit(["rebase", "main"]);
  if (!rebase.ok) {
    process.stderr.write(`${rebase.stderr}\n`);
    process.stderr.write(
      "The rebase stopped with conflicts. Your working tree has been left as-is.\n" +
        "  git status                 # see the conflicted files\n" +
        "  git rebase --continue      # after resolving and 'git add'\n" +
        "  git rebase --abort         # to put dev back the way it was\n",
    );
    return 1;
  }
  info(`dev is at ${git(["rev-parse", "--short", "HEAD"]).trim()}`);

  if (options.noPush) info("skipping push (--no-push)");
  else git(["push", "--force-with-lease", "origin", "dev"], { capture: false });

  step("Done");
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  if (error instanceof Abort) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  process.stderr.write(`${error?.stderr ?? error?.stack ?? error}\n`);
  process.exit(1);
}
