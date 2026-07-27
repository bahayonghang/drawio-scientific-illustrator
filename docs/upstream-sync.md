# Syncing this fork with upstream

This fork tracks [`icebird1998/drawio-scientific-illustrator`](https://github.com/icebird1998/drawio-scientific-illustrator).
Keeping the sync boring depends on one rule: **the upstream product is never
modified here.** Everything this fork adds lives outside the core area, so upstream
changes almost always fast-forward cleanly.

## Branch roles

| Branch | Role                                                               |
| ------ | ------------------------------------------------------------------ |
| `main` | A mirror of `upstream/main`. Fast-forward only. Never commit here. |
| `dev`  | All fork work. Rebased onto `main` after each sync.                |

A commit on `main` that upstream does not have breaks the fast-forward and turns
every future sync into a merge. That is why the sync script refuses to continue
rather than working around it.

## One command

```bash
npm run sync:upstream
```

Or directly:

```bash
node scripts/sync-upstream.mjs
```

It does, in order:

1. Verify the worktree is clean — otherwise abort.
2. Verify `origin` points at `bahayonghang/drawio-scientific-illustrator` and
   `upstream` at `icebird1998/drawio-scientific-illustrator` — otherwise abort.
3. `git fetch upstream --prune`.
4. Verify `main` can fast-forward to `upstream/main` — otherwise abort.
5. `git switch main` and `git merge --ff-only upstream/main`.
6. `git push origin main`.
7. `git switch dev` and `git rebase main`.
8. `git push --force-with-lease origin dev`.

### Options

| Option              | Effect                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| `--no-push`         | Do everything locally, push nothing. Good for a first run.                             |
| `--skip-dev-rebase` | Only fast-forward `main`; leave `dev` alone. Returns you to the branch you started on. |

### What it will not do

No `git reset --hard`. No bare `--force` push (only `--force-with-lease`, which
refuses if someone else pushed to `dev` in the meantime). No automatic conflict
resolution.

## When it aborts

Every abort leaves the repository as it found it.

**"The worktree has uncommitted changes"** — commit or stash, then re-run.

**"Remote `<name>` points at ... which does not look like ..."** — the script only
runs against this specific fork pair. Fix the remote:

```bash
git remote set-url upstream https://github.com/icebird1998/drawio-scientific-illustrator.git
```

**"main cannot be fast-forwarded"** — someone committed to `main` directly. The
script prints the offending commits. Move that work to `dev` and reset `main` to
match upstream, by hand. The script will not rewrite `main` for you.

## When the rebase conflicts

The script stops, leaves the rebase in progress, and prints:

```
git status                 # see the conflicted files
git rebase --continue      # after resolving and 'git add'
git rebase --abort         # to put dev back the way it was
```

Nothing is lost either way. If the conflict is in a core-area file
(`plugins/**`, `install.ps1`, `install.sh`, `README.md`,
`.agents/plugins/marketplace.json`), that is a signal the fork drifted into
territory it should not touch — prefer `--abort` and move the change out of the
core area.

Confirm the core area is clean at any time:

```bash
git diff upstream/main -- plugins/drawio-scientific-illustrator
```

Empty output is what you want.

## Effect on installed projects

None. The project-local installer copies files into the target project, so an
installed project has no link back to this checkout and is unaffected by a sync. To
pick up upstream's changes in an already-installed project, run
[`update.mjs`](project-local-install.md#updating) afterwards.
