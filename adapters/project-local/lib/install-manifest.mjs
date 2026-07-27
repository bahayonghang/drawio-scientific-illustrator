import fs from "node:fs";
import path from "node:path";

import { ExitError, log } from "./cli.mjs";

export const SCHEMA_VERSION = 2;
export const MANIFEST_RELATIVE = ".agents/drawio-scientific-install.json";

export function manifestPath(root) {
  return path.join(root, ".agents", "drawio-scientific-install.json");
}

export function readManifest(root) {
  const file = manifestPath(root);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }

  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw new ExitError(
      1,
      `Install manifest is not valid JSON: ${file}. Fix or remove it, then re-run. (${error.message})`,
    );
  }

  const version = manifest.schemaVersion ?? 1;
  if (version > SCHEMA_VERSION) {
    throw new ExitError(
      1,
      `Install manifest was written by a newer installer (schemaVersion ${version} > ${SCHEMA_VERSION}): ${file}`,
    );
  }
  if (version < SCHEMA_VERSION) return upgrade(manifest);
  return manifest;
}

function upgrade(manifest) {
  return {
    ...manifest,
    schemaVersion: SCHEMA_VERSION,
    mode: manifest.mode ?? "copy",
    platforms: manifest.platforms ?? {},
    managedPaths: manifest.managedPaths ?? [],
  };
}

export function writeManifest(root, manifest, { dryRun }) {
  const file = manifestPath(root);
  if (dryRun) {
    log.plan(`write install manifest ${MANIFEST_RELATIVE}`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

export function mergePlatforms(previous, updates) {
  return { ...(previous ?? {}), ...updates };
}
