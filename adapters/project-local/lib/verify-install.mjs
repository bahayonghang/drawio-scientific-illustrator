import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

import { expectedFiles } from "./skill-package.mjs";

const PROBE_TIMEOUT_MS = 8000;

export async function verifyInstall({ skillDirs }) {
  const problems = [];

  for (const skillDir of skillDirs) {
    for (const relative of expectedFiles()) {
      if (!existsSync(path.join(skillDir, relative))) {
        problems.push(
          `Missing after install: ${path.join(skillDir, relative)}`,
        );
      }
    }

    for (const relative of expectedFiles().filter((file) =>
      file.endsWith(".mjs"),
    )) {
      const file = path.join(skillDir, relative);
      if (!existsSync(file)) continue;
      try {
        execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
      } catch (error) {
        problems.push(`Syntax check failed: ${file}\n${error?.stderr ?? ""}`);
      }
    }

    const liveServer = path.join(skillDir, "scripts", "live-server.mjs");
    if (existsSync(liveServer)) {
      const probe = await probeServer(liveServer);
      if (!probe.ok)
        problems.push(`MCP probe failed for ${liveServer}: ${probe.reason}`);
    }
  }

  return { ok: problems.length === 0, problems };
}

export function probeServer(serverFile) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [serverFile], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const lines = createInterface({ input: child.stdout });
    const responses = new Map();
    let stderr = "";
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      lines.close();
      child.kill();
      resolve(result);
    };

    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          reason: `timed out after ${PROBE_TIMEOUT_MS} ms. ${stderr}`,
        }),
      PROBE_TIMEOUT_MS,
    );

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) =>
      finish({ ok: false, reason: error.message }),
    );
    child.once("exit", (code) => {
      if (responses.size < 2)
        finish({ ok: false, reason: `server exited with ${code}. ${stderr}` });
    });

    lines.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        finish({
          ok: false,
          reason: `invalid JSON on stdout: ${error.message}`,
        });
        return;
      }
      if (message.id === 1 || message.id === 2)
        responses.set(message.id, message);
      if (responses.size < 2) return;

      const tools = responses.get(2)?.result?.tools;
      if (!Array.isArray(tools) || tools.length === 0) {
        finish({ ok: false, reason: "tools/list returned no tools" });
        return;
      }
      finish({ ok: true, toolCount: tools.length });
    });

    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "project-local-installer", version: "1.0.0" } } })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`,
    );
  });
}
