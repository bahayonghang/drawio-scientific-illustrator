import { ExitError, log } from "./cli.mjs";
import { PLUGIN_ID, detectGlobalPlugin, runCodex } from "./codex-plugin.mjs";

const PLUGIN_REF = `${PLUGIN_ID}@drawio-scientific-tools`;

export function assertMigrationRequest({ platforms, skipVerification }) {
  if (!platforms.includes("codex")) {
    throw new ExitError(
      1,
      "--migrate-from-global-plugin only applies to the codex platform. Use --platform codex or --platform both.",
    );
  }
  if (skipVerification) {
    throw new ExitError(
      1,
      "--migrate-from-global-plugin cannot be combined with --skip-verification: the global plugin is only removed after the project-local install verifies.",
    );
  }

  const plugin = detectGlobalPlugin();
  if (!plugin.available) {
    throw new ExitError(
      1,
      "The codex CLI was not found on PATH, so the global plugin cannot be removed. Install Codex, or drop --migrate-from-global-plugin.",
    );
  }
  return plugin;
}

export function removeGlobalPlugin({ plugin, dryRun }) {
  if (!plugin.installed) {
    log.info(
      `The global plugin ${PLUGIN_ID} is not installed; nothing to migrate.`,
    );
    return { removed: false };
  }
  if (dryRun) {
    log.plan(`codex plugin remove ${PLUGIN_REF}`);
    return { removed: false };
  }

  try {
    runCodex(["plugin", "remove", PLUGIN_REF]);
  } catch (error) {
    throw new ExitError(
      1,
      `The project-local install succeeded, but removing the global plugin failed:\n${error?.stderr ?? error?.message ?? error}\nRun this yourself when convenient:\n  codex plugin remove ${PLUGIN_REF}`,
    );
  }

  log.ok(`removed the global plugin ${PLUGIN_REF}`);
  log.info(
    "Start a new Codex session and run `codex mcp list`; only the project-local drawio servers should remain.",
  );
  log.info(
    "The marketplace checkout was left on disk. Reinstall with `codex plugin add` if you want to roll back.",
  );
  return { removed: true };
}
