import fs from "node:fs";
import path from "node:path";

import { ExitError, log } from "./cli.mjs";
import { entriesEqual } from "./mcp-entries.mjs";

function readConfig(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT")
      return { config: { mcpServers: {} }, existed: false };
    throw error;
  }

  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    throw new ExitError(
      1,
      `${file} is not valid JSON. Fix or remove it, then re-run. (${error.message})`,
    );
  }
  if (!config.mcpServers || typeof config.mcpServers !== "object")
    config.mcpServers = {};
  return { config, existed: true };
}

function writeConfig(file, config, existed) {
  if (existed) fs.copyFileSync(file, `${file}.bak`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

function toEntry(name, server) {
  return {
    name,
    command: server?.command,
    args: server?.args,
    cwd: server?.cwd,
  };
}

export function patchMcpJson({
  file,
  entries,
  managedNames = [],
  force = false,
  dryRun = false,
  quiet = false,
}) {
  const { config, existed } = readConfig(file);
  const reused = [];
  const changed = [];

  for (const entry of entries) {
    const current = config.mcpServers[entry.name];
    if (current === undefined) {
      changed.push(entry.name);
      continue;
    }
    if (entriesEqual(toEntry(entry.name, current), entry)) {
      reused.push(entry.name);
      continue;
    }
    if (!managedNames.includes(entry.name) && !force) {
      throw new ExitError(
        2,
        `An MCP server named "${entry.name}" already exists in ${file} and this installer did not write it.\n` +
          `  existing: ${describe(current)}\n` +
          `  new:      ${describe(entry)}\n` +
          "Rename or remove the existing entry, or re-run with --force to replace it.",
      );
    }
    changed.push(entry.name);
  }

  if (changed.length === 0) return { changed, reused, wrote: false };
  if (dryRun) {
    if (!quiet) log.plan(`update ${changed.length} MCP server(s) in ${file}`);
    return { changed, reused, wrote: false };
  }

  for (const entry of entries) {
    if (!changed.includes(entry.name)) continue;
    config.mcpServers[entry.name] = buildServer(entry);
  }
  writeConfig(file, config, existed);
  return { changed, reused, wrote: true };
}

function buildServer(entry) {
  const server = { command: entry.command, args: entry.args };
  if (entry.cwd) server.cwd = entry.cwd;
  return server;
}

function describe(entry) {
  const parts = [
    `command=${entry.command}`,
    `args=${JSON.stringify(entry.args ?? [])}`,
  ];
  if (entry.cwd) parts.push(`cwd=${entry.cwd}`);
  return parts.join(" ");
}

export function removeMcpJson({ file, names, dryRun = false }) {
  if (!fs.existsSync(file)) return { changed: [] };
  const { config, existed } = readConfig(file);

  const changed = names.filter((name) => config.mcpServers[name] !== undefined);
  if (changed.length === 0) return { changed };
  if (dryRun) {
    log.plan(`remove ${changed.length} MCP server(s) from ${file}`);
    return { changed };
  }

  for (const name of changed) delete config.mcpServers[name];
  writeConfig(file, config, existed);
  return { changed };
}
