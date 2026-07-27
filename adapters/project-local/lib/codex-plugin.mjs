import { execFileSync } from "node:child_process";

export const PLUGIN_ID = "drawio-scientific-illustrator";

export function runCodex(args) {
  const options = { stdio: ["ignore", "pipe", "pipe"], windowsHide: true };
  if (process.platform !== "win32")
    return execFileSync("codex", args, options).toString();

  const shell = process.env.ComSpec ?? "cmd.exe";
  return execFileSync(
    shell,
    ["/d", "/s", "/c", "codex", ...args],
    options,
  ).toString();
}

export function detectGlobalPlugin() {
  let output;
  try {
    output = runCodex(["plugin", "list"]);
  } catch (error) {
    if (isMissingCommand(error)) return { available: false, installed: false };
    return { available: true, installed: false };
  }
  return { available: true, installed: output.includes(PLUGIN_ID) };
}

function isMissingCommand(error) {
  if (error?.code === "ENOENT") return true;
  const output = `${error?.stderr ?? ""}${error?.stdout ?? ""}`;
  return /not recognized as an internal or external command|command not found/i.test(
    output,
  );
}
