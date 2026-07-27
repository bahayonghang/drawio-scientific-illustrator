import { ExitError } from "./cli.mjs";
import { readManifest } from "./install-manifest.mjs";
import { resolveProjectRoot } from "./project-root.mjs";

export function loadInstalled(projectInput, { required = true } = {}) {
  const { root, isGitRepo } = resolveProjectRoot(projectInput);
  const manifest = readManifest(root);

  if (!manifest) {
    if (!required) return { root, isGitRepo, manifest: null, platforms: [] };
    throw new ExitError(
      1,
      `No install manifest found in ${root}. Run install.mjs first.`,
    );
  }

  return {
    root,
    isGitRepo,
    manifest,
    platforms: Object.keys(manifest.platforms ?? {}),
  };
}
