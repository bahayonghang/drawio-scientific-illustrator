import { existsSync } from "node:fs";
import path from "node:path";

import { ExitError } from "./cli.mjs";
import { SKILL_NAME } from "./paths.mjs";

export const PLATFORMS = ["claude", "codex"];

const SKILL_PARENTS = {
  claude: path.join(".claude", "skills"),
  codex: path.join(".agents", "skills"),
};

export function skillDirFor(platform, root) {
  const parent = SKILL_PARENTS[platform];
  if (!parent) throw new ExitError(1, `Unknown platform: ${platform}`);
  return path.join(root, parent, SKILL_NAME);
}

export function skillRelativePath(platform) {
  return `${SKILL_PARENTS[platform].split(path.sep).join("/")}/${SKILL_NAME}`;
}

export function resolvePlatforms(input, root) {
  if (input === "both") return [...PLATFORMS];
  if (PLATFORMS.includes(input)) return [input];
  if (input !== "auto") throw new ExitError(1, `Unknown platform: ${input}`);

  const detected = [];
  if (existsSync(path.join(root, ".claude"))) detected.push("claude");
  if (
    existsSync(path.join(root, ".codex")) ||
    existsSync(path.join(root, ".agents"))
  ) {
    detected.push("codex");
  }
  if (detected.length === 0) {
    throw new ExitError(
      1,
      `Cannot detect a platform in ${root}: neither .claude/ nor .codex/ nor .agents/ exists. Pass --platform claude|codex|both.`,
    );
  }
  return detected;
}
