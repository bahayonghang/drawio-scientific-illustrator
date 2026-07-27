import fs from "node:fs";
import path from "node:path";

import { log } from "./cli.mjs";
import { detectGlobalPlugin } from "./codex-plugin.mjs";
import { SERVER_NAMES, entriesFor } from "./mcp-entries.mjs";
import {
  patchCodexConfig,
  readManagedProject,
  removeCodexConfig,
  userConfigPath,
} from "./patch-codex-config.mjs";
import { normalize } from "./paths.mjs";
import { patchMcpJson, removeMcpJson } from "./patch-mcp-json.mjs";

const CODEX_BUG_NOTE =
  "Codex does not load project-level MCP servers today (openai/codex#13025); the user-level entry is what makes them work.";

export function claudeConfigPath(root) {
  return path.join(root, ".mcp.json");
}

export function codexProjectConfigPath(root) {
  return path.join(root, ".codex", "config.toml");
}

export function checkMcpConflicts(options) {
  if (options.scope === "none") return;
  writeMcpConfig({ ...options, dryRun: true, quiet: true });
}

export function writeMcpConfig({
  scope,
  root,
  platforms,
  skillDirs,
  manifest,
  pathStyle = "relative",
  force = false,
  dryRun = false,
  quiet = false,
}) {
  if (scope === "none") return { changed: [], reused: [], warnings: [] };
  const say = quiet ? () => {} : log.info;
  const warn = quiet ? () => {} : log.warn;

  const changed = [];
  const created = [];
  const reused = [];
  const warnings = [];

  for (const platform of platforms) {
    const skillDir = skillDirs.get(platform);

    if (platform === "claude") {
      const file = claudeConfigPath(root);
      const result = patchMcpJson({
        file,
        entries: entriesFor({ platform, root, skillDir, pathStyle }),
        managedNames: managedNamesFor(manifest, "claude"),
        force,
        dryRun,
        quiet,
      });
      if (result.changed.length > 0) changed.push(file);
      if (result.created) created.push(file);
      if (result.reused.length > 0) {
        reused.push(file);
        say(`reused existing entries in ${file}: ${result.reused.join(", ")}`);
      }
      continue;
    }

    const plugin = quiet ? { installed: false } : detectGlobalPlugin();
    if (plugin.installed) {
      warnings.push(
        `The global Codex plugin is still installed and registers the same server names (${SERVER_NAMES.join(", ")}). Run install.mjs with --migrate-from-global-plugin, or use --mcp none.`,
      );
    }

    const projectFile = codexProjectConfigPath(root);
    const projectResult = patchCodexConfig({
      file: projectFile,
      entries: entriesFor({ platform, root, skillDir, absolute: false }),
      projectRoot: root,
      force,
      dryRun,
      quiet,
    });
    if (projectResult.changed) changed.push(projectFile);
    if (projectResult.created) created.push(projectFile);

    const userFile = userConfigPath();
    const userResult = patchCodexConfig({
      file: userFile,
      entries: entriesFor({ platform, root, skillDir, absolute: true }),
      projectRoot: root,
      force,
      dryRun,
      quiet,
      enforceBinding: true,
    });
    if (userResult.changed) changed.push(userFile);
    if (userResult.created) created.push(userFile);
    if (userResult.rebindFrom) {
      warn(
        `rebound Codex MCP servers from ${userResult.rebindFrom} to ${root}`,
      );
    }
    say(CODEX_BUG_NOTE);
  }

  for (const warning of warnings) warn(warning);
  return { changed, created, reused, warnings };
}

export function removeMcpConfig({
  root,
  platforms,
  createdFiles = [],
  dryRun = false,
}) {
  const changed = [];
  const wasCreated = new Set(createdFiles.map((file) => normalize(file)));

  const finish = (file, result) => {
    changed.push(file);
    if (!result.emptied) return;
    if (!wasCreated.has(normalize(file))) return;
    if (dryRun) log.plan(`remove ${file}`);
    else fs.rmSync(file, { force: true });
  };

  for (const platform of platforms) {
    if (platform === "claude") {
      const file = claudeConfigPath(root);
      const result = removeMcpJson({ file, names: SERVER_NAMES, dryRun });
      if (result.changed.length > 0) finish(file, result);
      continue;
    }

    const projectFile = codexProjectConfigPath(root);
    const projectResult = removeCodexConfig({ file: projectFile, dryRun });
    if (projectResult.changed) finish(projectFile, projectResult);

    const userFile = userConfigPath();
    const bound = readManagedProject(userFile);
    if (bound && normalize(bound) !== normalize(root)) {
      log.warn(
        `left the user-level Codex block alone: it is bound to ${bound}, not ${root}.`,
      );
      continue;
    }
    const userResult = removeCodexConfig({ file: userFile, dryRun });
    if (userResult.changed) finish(userFile, userResult);
  }

  return { changed };
}

function managedNamesFor(manifest, platform) {
  return manifest?.platforms?.[platform]?.mcpConfig ? SERVER_NAMES : [];
}
