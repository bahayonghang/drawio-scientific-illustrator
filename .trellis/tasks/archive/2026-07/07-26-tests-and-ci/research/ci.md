# CI evidence

First push of `dev` to `origin`: 2026-07-27, head `0c544e5`. The branch had never
existed on the remote before, so this created it.

## Runs

| Workflow                       | Run                                                                                                   | Result  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ------- |
| Project-local adapter          | [30248517365](https://github.com/bahayonghang/drawio-scientific-illustrator/actions/runs/30248517365) | success |
| Validate plugin (pre-existing) | [30248517368](https://github.com/bahayonghang/drawio-scientific-illustrator/actions/runs/30248517368) | success |

Both matrix legs of the adapter workflow passed, every step included:

| Job                         | `npm run check` | `npm run test:project-local` | Rehearse an install |
| --------------------------- | --------------- | ---------------------------- | ------------------- |
| `test (ubuntu-latest, 22)`  | success         | success                      | success             |
| `test (windows-latest, 22)` | success         | success                      | success             |

No step was skipped, so the pollution guard and the `--dry-run` rehearsal both
actually executed on each runner.

## The Linux risk did not materialise

`design.md` §6 flagged that the adapter had only ever run on Windows, and that the
Linux job was its first POSIX execution — specifically the `codex`-absent branch of
`detectGlobalPlugin()`, which was silently broken on Windows until subtask 4. It
passed on the first run. No POSIX-specific defect was found.

## Note on reading the results

`gh run list` reported no runs at all for several minutes after the push, and then
kept showing runs from 2026-07-21/24 as the newest. Querying
`repos/{owner}/{repo}/actions/runs` directly returned both of today's runs
immediately. If CI looks like it never fired, check the API before assuming the
trigger is wrong.
