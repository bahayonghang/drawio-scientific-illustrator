#!/usr/bin/env bash
# Rehearsal harness for scripts/sync-upstream.mjs.
# Builds throwaway bare repos whose directory names impersonate the two
# expected GitHub owners, so the script's remote-URL guard is exercised for
# real instead of being stubbed out.
set -u

SRC="$1"          # path to the real repo (source of sync-upstream.mjs)
BASE="$2"         # scratch directory for the drill

GIT="git -c user.email=t@example.com -c user.name=t -c init.defaultBranch=main"

rm -rf "$BASE"
mkdir -p "$BASE/icebird1998" "$BASE/bahayonghang"

UPSTREAM="$BASE/icebird1998/drawio-scientific-illustrator.git"
ORIGIN="$BASE/bahayonghang/drawio-scientific-illustrator.git"

# --- seed the upstream repository -------------------------------------------
$GIT init -q "$BASE/seed"
mkdir -p "$BASE/seed/scripts"
cp "$SRC/scripts/sync-upstream.mjs" "$BASE/seed/scripts/"
printf 'line one\nline two\n' > "$BASE/seed/README.md"
$GIT -C "$BASE/seed" add -A
$GIT -C "$BASE/seed" commit -q -m "upstream base"
$GIT clone -q --bare "$BASE/seed" "$UPSTREAM"
$GIT clone -q --bare "$BASE/seed" "$ORIGIN"
# The scratch path is deep enough that unpack-objects hits MAX_PATH on Windows.
$GIT -C "$UPSTREAM" config core.longpaths true
$GIT -C "$ORIGIN" config core.longpaths true

# --- author one upstream-only commit ----------------------------------------
$GIT clone -q "$UPSTREAM" "$BASE/upstream-work"
printf 'line one\nline two\nupstream addition\n' > "$BASE/upstream-work/README.md"
$GIT -C "$BASE/upstream-work" commit -qam "upstream feature"
$GIT -C "$BASE/upstream-work" push -q origin main

# --- build the fork working clone -------------------------------------------
$GIT clone -q "$ORIGIN" "$BASE/work"
W="$BASE/work"
$GIT -C "$W" remote add upstream "$UPSTREAM"
$GIT -C "$W" switch -qc dev
printf 'fork note\n' > "$W/FORK.md"
$GIT -C "$W" add -A
$GIT -C "$W" commit -q -m "fork work on dev"
$GIT -C "$W" push -q -u origin dev >/dev/null 2>&1

run() {
  echo
  echo "### $1"
  shift
  ( cd "$W" && node "$W/scripts/sync-upstream.mjs" "$@" 2>&1 )
  echo "[exit=$?]"
}

snapshot() {
  echo "--- state: branch=$($GIT -C "$W" rev-parse --abbrev-ref HEAD) \
main=$($GIT -C "$W" rev-parse --short main) \
dev=$($GIT -C "$W" rev-parse --short dev) \
status='$($GIT -C "$W" status --porcelain | tr '\n' ';')'"
}

echo "=========== S1: dirty worktree ==========="
printf 'uncommitted\n' > "$W/DIRTY.txt"
snapshot
run "sync-upstream.mjs --no-push (dirty)" --no-push
snapshot
rm "$W/DIRTY.txt"

echo
echo "=========== S2: unexpected remote ==========="
$GIT -C "$W" remote set-url upstream "$BASE/icebird1998"
snapshot
run "sync-upstream.mjs --no-push (bad upstream url)" --no-push
snapshot
$GIT -C "$W" remote set-url upstream "$UPSTREAM"

echo
echo "=========== S3: main cannot fast-forward ==========="
$GIT -C "$W" switch -q main
printf 'private\n' > "$W/PRIVATE.md"
$GIT -C "$W" add -A
$GIT -C "$W" commit -q -m "private commit on main"
$GIT -C "$W" switch -q dev
snapshot
run "sync-upstream.mjs --no-push (main ahead)" --no-push
snapshot
$GIT -C "$W" switch -q main
$GIT -C "$W" reset -q --hard HEAD~1   # drill fixture reset, not the script's doing
$GIT -C "$W" switch -q dev

echo
echo "=========== S4: happy path ==========="
snapshot
echo "upstream/main before fetch: $($GIT -C "$W" rev-parse --short refs/remotes/upstream/main 2>/dev/null || echo '<none>')"
run "sync-upstream.mjs --no-push" --no-push
snapshot
echo "main == upstream/main ? $([ "$($GIT -C "$W" rev-parse main)" = "$($GIT -C "$W" rev-parse upstream/main)" ] && echo yes || echo no)"
echo "dev log:"
$GIT -C "$W" log --oneline dev | sed 's/^/    /'
echo "origin/main unchanged (no push)? $([ "$($GIT -C "$ORIGIN" rev-parse main)" != "$($GIT -C "$W" rev-parse main)" ] && echo yes || echo no)"

echo
echo "=========== S5: rebase conflict ==========="
# dev and upstream both touch README.md line 3
$GIT -C "$W" switch -q dev
printf 'line one\nline two\nfork addition\n' > "$W/README.md"
$GIT -C "$W" commit -qam "fork edits README"
$GIT -C "$BASE/upstream-work" pull -q --ff-only
printf 'line one\nline two\nupstream addition\nupstream second\n' > "$BASE/upstream-work/README.md"
$GIT -C "$BASE/upstream-work" commit -qam "upstream edits README again"
$GIT -C "$BASE/upstream-work" push -q origin main
snapshot
run "sync-upstream.mjs --no-push (conflict)" --no-push
echo "--- rebase in progress? $([ -d "$W/.git/rebase-merge" ] || [ -d "$W/.git/rebase-apply" ] && echo yes || echo no)"
$GIT -C "$W" status --porcelain | sed 's/^/    /'
$GIT -C "$W" rebase --abort
echo "--- after 'git rebase --abort':"
snapshot
echo "dev log:"
$GIT -C "$W" log --oneline dev | sed 's/^/    /'

echo
echo "=========== S6: --skip-dev-rebase ==========="
DEV_BEFORE=$($GIT -C "$W" rev-parse dev)
run "sync-upstream.mjs --no-push --skip-dev-rebase" --no-push --skip-dev-rebase
snapshot
echo "dev untouched? $([ "$DEV_BEFORE" = "$($GIT -C "$W" rev-parse dev)" ] && echo yes || echo no)"

echo
echo "=========== S7: unknown option ==========="
run "sync-upstream.mjs --bogus" --bogus
