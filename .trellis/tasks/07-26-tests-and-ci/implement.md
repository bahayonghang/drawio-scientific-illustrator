# Implement — Tests and CI for the project-local adapter

## Checklist

1. **`tests/paths.test.mjs`** (new)
   - `~` and `~/sub` expand to the home directory; a bare relative path resolves
     against cwd.
   - Windows only: a lowercase drive letter is uppercased. Skipped elsewhere via
     `{ skip: process.platform !== "win32" }` — an assertion that silently does
     nothing on Linux is worse than a visible skip.
   - `toPosix` / `relativePosix` return forward slashes on both platforms.
   - `assertSourcesPresent` throws `ExitError(1)` naming the missing file when
     the checkout is incomplete. Needs `sourceRoot` to be temporarily wrong —
     assert against the real checkout for the happy path, and cover the failure
     branch by calling the same `existsSync` predicate over a fabricated list.

2. **`tests/patch-codex-config.test.mjs`** (extend)
   - Add: an absolute Windows-style skill path produces a TOML `cwd` containing
     no backslashes, and the file re-reads to the same value.

3. **`tests/integration.test.mjs`** (new) — matrix rows 1–8, each driving
   `install.mjs` through `runCli` with a temp `CODEX_HOME`:
   - Rows 1–3: exit 0; assert the five-file skill package exists per platform,
     `.mcp.json` / `.codex/config.toml` contents, manifest platform keys.
   - Row 4: `makeTempDir` instead of `makeGitRepo`; assert install succeeds and
     no `.git/info/exclude` was fabricated.
   - Row 5: install twice; assert the second run exits 0 and the on-disk bytes
     of `.mcp.json`, the Codex config and the skill files are unchanged apart
     from the manifest's `updatedAt`.
   - Row 6: pre-write `.mcp.json` with the exact entries the installer would
     write; assert exit 0, "reused" reported, file byte-identical.
   - Row 7: pre-write `.mcp.json` with a conflicting `drawio-live` command;
     assert exit 2 and the file byte-identical.
   - Row 8: pre-create `.claude/skills/<name>/` with a foreign file, run with
     `--mcp none`; assert exit 2 and the foreign file intact.

4. **`tests/lifecycle.test.mjs`** (extend) — matrix row 9: capture
   `sourceCommit`/`updatedAt` after install, run `update.mjs`, assert
   `updatedAt` advanced and `sourceCommit` matches the fork's current HEAD.

5. **`tests/check-global-pollution.mjs`** (new) — the three absolute
   post-conditions from design §3. Exits 1 listing offenders. Must read the real
   `os.homedir()`, so it explicitly ignores `CODEX_HOME`.

6. **`package.json`**
   - `test:project-local`: quoted-glob `node --test` then the pollution check.
   - `test:all`: `npm test && npm run test:project-local`.
   - `npm test` unchanged.

7. **`scripts/validate-repo.mjs`** — extend the local-path/credential scan to
   `adapters/project-local/**/*.mjs` (design §7). Keep the existing five files.

8. **`.github/workflows/project-local-adapter.yml`** (new) — design §6.

## Validation

```bash
npm run test:all
node --test "adapters/project-local/tests/*.test.mjs"
node adapters/project-local/tests/check-global-pollution.mjs
node scripts/validate-repo.mjs
```

Then push `dev` and record the CI run URLs in `research/ci.md`. Both jobs must
be green; a Linux failure is a real finding, not a reason to weaken the test.

## Gates

- All prior 55 tests still pass — this task adds coverage, it does not rewrite
  behaviour. Any test that starts failing means subtasks 2–4 shipped a bug and
  the fix belongs to the source file, not the assertion.
- The pollution check passes against the developer's real home directory.
- CI green on `windows-latest` and `ubuntu-latest`, evidence in `research/`.

## Rollback

Single commit; revertable on its own. Nothing here changes installer behaviour
except the `validate-repo.mjs` scan widening, which can only fail a build, never
alter an install.
