# Verification — sync-upstream.mjs

Date: 2026-07-27. Platform: Windows 11, Node 25.9.0, Git Bash.

## How the drill works

`sync-upstream-drill.sh` builds a throwaway fixture under a scratch directory:

```
<base>/icebird1998/drawio-scientific-illustrator.git   (bare, plays "upstream")
<base>/bahayonghang/drawio-scientific-illustrator.git  (bare, plays "origin")
<base>/upstream-work/                                  (authors upstream-only commits)
<base>/work/                                           (the fork clone under test)
```

The bare repos are deliberately _named_ after the two expected GitHub owners.
`sync-upstream.mjs` validates remotes by looking for `<owner>/<repo>` inside the
normalized URL, so a local path like
`.../drill/icebird1998/drawio-scientific-illustrator.git` satisfies the real
guard. No test hook, env override, or bypass flag was added to the script —
the check that runs in the drill is the check that runs in production.

`sync-upstream.mjs` derives its repo root from its own location, so the drill
copies the script into `<base>/work/scripts/` (committed, to keep the worktree
clean) and runs that copy.

Reproduce:

```bash
bash .trellis/tasks/07-26-upstream-sync/research/sync-upstream-drill.sh <repo-root> <scratch-dir>
```

Full transcript: `sync-upstream-drill.log`.

## Results

| #   | Scenario                                                          | Expected                                                       | Observed                                                                                                                                                          |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Dirty worktree                                                    | abort, repo untouched                                          | exit 1, lists `?? DIRTY.txt`; `main`/`dev` SHAs and status identical before and after                                                                             |
| S2  | `upstream` URL is not `icebird1998/drawio-scientific-illustrator` | abort before any git mutation                                  | exit 1, names the bad URL; SHAs unchanged; no fetch performed                                                                                                     |
| S3  | `main` carries a private commit (not fast-forwardable)            | abort, `main` not rewritten                                    | exit 1, prints the offending commit `2895ec2 private commit on main`; `main` still at `2895ec2`                                                                   |
| S4  | Clean, `--no-push`                                                | `main` fast-forwards, `dev` rebases, nothing pushed            | `Updating fd75767..29da366`, `main == upstream/main` yes, `dev` replays on top (`d1dbc7b fork work on dev` → `29da366 upstream feature`), `origin/main` unchanged |
| S5  | `dev` and upstream both edit `README.md` line 3                   | rebase stops, guidance printed, non-zero exit, state preserved | exit 1, three-line guidance printed, `UU README.md`, rebase in progress = yes; `git rebase --abort` restores `dev` to `c314560` with its original log             |
| S6  | `--skip-dev-rebase`                                               | only `main` moves; return to the starting branch               | `dev` SHA identical before/after; ends on `dev` (the branch the run started from)                                                                                 |
| S7  | Unknown option                                                    | usage + non-zero exit                                          | exit 1, prints `Unknown option: --bogus` followed by usage                                                                                                        |

## Notes and limitations

- **Ordering of the guards.** Dirty-worktree and remote-URL checks run before
  `git fetch`. The non-fast-forward check runs _after_ `fetch upstream --prune`,
  because it needs `upstream/main` to compare against. That fetch updates remote
  tracking refs only — no branch, index, or worktree change — so S3 still leaves
  the repository usable exactly as it was found.
- **Branch restoration.** The script returns to the starting branch only on the
  `--skip-dev-rebase` path (S6). On the normal path it deliberately ends on `dev`,
  which is where the rebase left you. The abort paths never switch branches at all.
- **`push` was never exercised against a real remote.** Every drill scenario ran
  with `--no-push`; S4 asserts `origin/main` did _not_ move. The
  `push origin main` / `push --force-with-lease origin dev` calls are therefore
  unverified end-to-end and will first execute for real during the release
  rehearsal in `07-26-docs-release`.
- **Fixture bug found and fixed mid-drill.** The first run failed to seed the
  upstream-only commit: `unpack-objects` in the bare repo hit `Filename too long`
  because the scratch path is deep. S4 then reported "Already up to date" and S5
  produced no conflict — both would have been false passes. Fixed by setting
  `core.longpaths true` on the two bare repos. The `grep -c "Filename too long"`
  on the final log is 0.

## Handoff to `07-26-tests-and-ci`

`npm run check` still only `node --check`s the three plugin servers. Adding
`scripts/sync-upstream.mjs` to that list (and deciding whether the drill becomes
an automated test rather than a manual rehearsal) is left to subtask 6, which
owns the test and CI wiring.
