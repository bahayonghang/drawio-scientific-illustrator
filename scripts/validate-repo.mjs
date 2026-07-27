import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marketplacePath = path.join(
  root,
  ".agents",
  "plugins",
  "marketplace.json",
);
const marketplace = JSON.parse(await fs.readFile(marketplacePath, "utf8"));

if (marketplace.name !== "drawio-scientific-tools")
  throw new Error("Unexpected marketplace name.");
if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1)
  throw new Error("Marketplace must expose exactly one plugin.");

const entry = marketplace.plugins[0];
const pluginRoot = path.resolve(
  path.dirname(marketplacePath),
  "..",
  "..",
  entry.source.path,
);
const manifest = JSON.parse(
  await fs.readFile(
    path.join(pluginRoot, ".codex-plugin", "plugin.json"),
    "utf8",
  ),
);
const mcp = JSON.parse(
  await fs.readFile(path.join(pluginRoot, ".mcp.json"), "utf8"),
);

if (entry.name !== manifest.name)
  throw new Error("Marketplace and manifest plugin names differ.");
if (manifest.version !== "1.0.0")
  throw new Error("Unexpected public release version.");
if (!mcp.mcpServers?.["drawio-live"] || !mcp.mcpServers?.["drawio-file-utils"])
  throw new Error("Required MCP servers are missing.");

const adapterDir = path.join(root, "adapters", "project-local");
const adapterFiles = await fs.readdir(adapterDir, {
  recursive: true,
  withFileTypes: true,
});

const files = [
  marketplacePath,
  path.join(pluginRoot, ".codex-plugin", "plugin.json"),
  path.join(pluginRoot, ".mcp.json"),
  path.join(pluginRoot, "scripts", "live-server.mjs"),
  path.join(pluginRoot, "scripts", "server.mjs"),
  // The adapter is copied into user projects, so a leaked local path there is
  // just as damaging as one in the plugin itself.
  ...adapterFiles
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => path.join(entry.parentPath, entry.name)),
];

for (const file of files) {
  const text = await fs.readFile(file, "utf8");
  if (
    /C:\\Users\\[^\\]+|C:\/Users\/[^/]+|ProgramData\\miniconda3|gho_|github_pat_/i.test(
      text,
    )
  ) {
    throw new Error(
      `Local path or credential-like value found in ${path.relative(root, file)}.`,
    );
  }
}

console.log("Repository structure and portability checks passed.");
