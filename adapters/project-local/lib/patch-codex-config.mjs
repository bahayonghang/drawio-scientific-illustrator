import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { backupPathFor } from "./backup.mjs";
import { ExitError, log } from "./cli.mjs";
import { SERVER_NAMES } from "./mcp-entries.mjs";
import { normalize } from "./paths.mjs";

const BEGIN = "# >>> drawio-scientific-illustrator managed block";
const END = "# <<< drawio-scientific-illustrator managed block";
const PROJECT_MARKER = "# project: ";

const TABLE_HEADER =
  /^\s*\[mcp_servers\.(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\]\s*$/;

function readText(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    return { text: text.replace(/^﻿/, ""), existed: true };
  } catch (error) {
    if (error?.code === "ENOENT") return { text: "", existed: false };
    throw error;
  }
}

function locateBlock(lines) {
  const start = lines.indexOf(BEGIN);
  if (start === -1) return null;
  const end = lines.indexOf(END, start);
  if (end === -1) return null;
  return { start, end };
}

export function readManagedProject(file) {
  const { text, existed } = readText(file);
  if (!existed) return null;
  const lines = text.split(/\r?\n/);
  const block = locateBlock(lines);
  if (!block) return null;

  for (const line of lines.slice(block.start, block.end)) {
    if (line.startsWith(PROJECT_MARKER))
      return line.slice(PROJECT_MARKER.length).trim();
  }
  return null;
}

function assertNoOutsideHeaders(lines, block) {
  for (let index = 0; index < lines.length; index += 1) {
    if (block && index >= block.start && index <= block.end) continue;
    const match = TABLE_HEADER.exec(lines[index]);
    if (!match) continue;
    const name = match[1] ?? match[2] ?? match[3];
    if (!SERVER_NAMES.includes(name)) continue;
    throw new ExitError(
      2,
      `[mcp_servers."${name}"] is already defined outside this installer's managed block (line ${index + 1}).\n` +
        "Remove that table or rename the server, then re-run.",
    );
  }
}

function renderBlock(entries, projectRoot) {
  const lines = [BEGIN, `${PROJECT_MARKER}${projectRoot}`];
  for (const entry of entries) {
    lines.push(
      "",
      `[mcp_servers."${entry.name}"]`,
      `command = ${quote(entry.command)}`,
      `args = [${entry.args.map(quote).join(", ")}]`,
    );
    if (entry.cwd) lines.push(`cwd = ${quote(entry.cwd)}`);
  }
  lines.push(END);
  return lines;
}

function quote(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function write(file, lines, newline, existed) {
  if (existed) fs.copyFileSync(file, backupPathFor(file));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(
    tmp,
    lines.length > 0 ? `${lines.join(newline)}${newline}` : "",
    "utf8",
  );
  fs.renameSync(tmp, file);
}

export function patchCodexConfig({
  file,
  entries,
  projectRoot,
  force = false,
  dryRun = false,
  quiet = false,
  enforceBinding = false,
}) {
  const { text, existed } = readText(file);
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text === "" ? [] : text.split(/\r?\n/);
  const block = locateBlock(lines);

  assertNoOutsideHeaders(lines, block);

  const normalizedRoot = normalize(projectRoot);
  let rebindFrom = null;
  if (enforceBinding && block) {
    const bound = readManagedProject(file);
    if (bound && normalize(bound) !== normalizedRoot) {
      if (!force) {
        throw new ExitError(
          2,
          `Codex's drawio MCP servers are currently bound to ${bound}.\n` +
            `Installing here would rebind them to ${normalizedRoot}, because Codex only loads MCP servers from the user-level config (openai/codex#13025).\n` +
            "Re-run with --force to rebind, or use --mcp none to install the skill only.",
        );
      }
      rebindFrom = bound;
    }
  }

  const created = !existed;
  const rendered = renderBlock(entries, normalizedRoot);
  const before = block ? lines.slice(0, block.start) : [...lines];
  const after = block ? lines.slice(block.end + 1) : [];
  while (before.length > 0 && before[before.length - 1] === "") before.pop();

  const next = [
    ...before,
    ...(before.length > 0 ? [""] : []),
    ...rendered,
    ...trimLeadingBlanks(after),
  ];
  const nextText = next.length > 0 ? `${next.join(newline)}${newline}` : "";
  if (
    existed &&
    nextText === (text.endsWith(newline) ? text : `${text}${newline}`)
  ) {
    return { changed: false, rebindFrom, wrote: false, created: false };
  }

  if (dryRun) {
    if (!quiet) log.plan(`update managed block in ${file}`);
    return { changed: true, rebindFrom, wrote: false, created };
  }

  write(file, next, newline, existed);
  return { changed: true, rebindFrom, wrote: true, created };
}

function trimLeadingBlanks(lines) {
  const copy = [...lines];
  while (copy.length > 0 && copy[0] === "") copy.shift();
  return copy.length > 0 ? ["", ...copy] : [];
}

export function removeCodexConfig({ file, dryRun = false }) {
  const { text, existed } = readText(file);
  if (!existed) return { changed: false };

  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const block = locateBlock(lines);
  if (!block) return { changed: false };

  if (dryRun) {
    log.plan(`remove managed block from ${file}`);
    return { changed: true };
  }

  const before = lines.slice(0, block.start);
  while (before.length > 0 && before[before.length - 1] === "") before.pop();
  const next = [...before, ...trimLeadingBlanks(lines.slice(block.end + 1))];
  while (next.length > 0 && next[next.length - 1] === "") next.pop();

  if (next.length === 0) return { changed: true, emptied: true };

  write(file, next, newline, existed);
  return { changed: true, emptied: false };
}

export function userConfigPath() {
  return path.join(
    process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"),
    "config.toml",
  );
}
