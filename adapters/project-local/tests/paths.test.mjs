import assert from "node:assert/strict";
import fs, { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ExitError } from "../lib/cli.mjs";
import {
  SOURCE_FILES,
  assertSourcesPresent,
  normalize,
  relativePosix,
  sourceRoot,
  toPosix,
} from "../lib/paths.mjs";
import { cleanup, makeTempDir } from "./helpers.mjs";

test("expands ~ to the home directory", () => {
  assert.equal(normalize("~"), path.resolve(os.homedir()));
  assert.equal(
    normalize(path.join("~", "projects")),
    path.resolve(os.homedir(), "projects"),
  );
});

test("resolves a relative path against the working directory", () => {
  assert.equal(normalize("."), path.resolve("."));
});

test(
  "uppercases a lowercase drive letter",
  { skip: process.platform !== "win32" },
  () => {
    assert.equal(normalize("c:/temp"), "C:\\temp");
    assert.equal(normalize("C:/temp"), "C:\\temp");
  },
);

test("toPosix and relativePosix always emit forward slashes", () => {
  const root = path.join(path.sep, "a", "b");
  const nested = path.join(root, "c", "d");

  assert.equal(toPosix(nested).includes("\\"), false);
  assert.equal(relativePosix(root, nested), "c/d");
});

test("every declared source file exists in this checkout", () => {
  assertSourcesPresent();

  for (const file of SOURCE_FILES) {
    assert.equal(
      existsSync(path.join(sourceRoot, file.from)),
      true,
      `missing source: ${file.from}`,
    );
  }
});

test("an incomplete checkout aborts and names every missing file", () => {
  const partial = makeTempDir("sources");
  const [first, ...rest] = SOURCE_FILES;
  const kept = path.join(partial, first.from);
  fs.mkdirSync(path.dirname(kept), { recursive: true });
  fs.writeFileSync(kept, "present\n");

  assert.throws(
    () => assertSourcesPresent(partial),
    (error) => {
      assert.ok(error instanceof ExitError);
      assert.equal(error.code, 1);
      assert.equal(error.message.includes(first.from), false);
      for (const file of rest) assert.ok(error.message.includes(file.from));
      return true;
    },
  );

  cleanup(partial);
});
