import { execFileSync } from "node:child_process";

export const PLUGIN_ID = "drawio-scientific-illustrator";

export function detectGlobalPlugin() {
  let output;
  try {
    output = execFileSync("codex", ["plugin", "list"], {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch (error) {
    if (error?.code === "ENOENT") return { available: false, installed: false };
    return { available: true, installed: false };
  }
  return { available: true, installed: output.includes(PLUGIN_ID) };
}
