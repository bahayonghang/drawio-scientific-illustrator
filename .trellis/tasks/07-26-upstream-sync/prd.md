# Upstream sync script

父任务:`07-26-project-local-skill`。前置:07-26-baseline-fork-docs(可与子任务 2-4 并行)。
任务性质:轻量,PRD-only 可激活。

## Goal

实现 `scripts/sync-upstream.mjs`:一条命令完成 upstream → main(ff-only)→ dev(rebase)
的安全同步,替代草稿文档 §15 的 PowerShell 版本。

## Requirements

- 流程:确认 git 仓库 → 工作区干净(否则中止)→ 校验 origin/upstream URL 符合预期
  (bahayonghang / icebird1998,不符则中止)→ `fetch upstream --prune` →
  `switch main` → `merge --ff-only upstream/main` → `push origin main` →
  `switch dev` → `rebase main` → `push --force-with-lease origin dev`。
- 参数:`--no-push`(本地同步不推送)、`--skip-dev-rebase`(只同步 main)。
- 禁止:`reset --hard`、裸 `--force`、自动解决冲突。
- rebase 冲突时:保留现场,打印 `git status` / `git rebase --continue` /
  `git rebase --abort` 三条指引后以非零退出。
- main 不能 ff 时中止并说明(意味着 main 上有私有提交,需人工处理)。
- git 调用用 `node:child_process` `execFileSync("git", [...])`,不经 shell,零依赖;
  仓库路径取脚本自身位置推导,不硬编码。
- 脚本注册到 `package.json`(如 `sync:upstream`)可选,若加需确认 validate-repo 不受影响。

## Acceptance Criteria

- [ ] 脏工作区、remote URL 不符、main 不可 ff 三种场景均中止且不改动仓库状态
      (用临时克隆仓库演练,证据存 research/)。
- [ ] 干净场景 `--no-push` 演练成功:main 与 upstream/main 对齐,dev 完成 rebase。
- [ ] 冲突场景演练:指引输出正确,`git rebase --abort` 后仓库还原。
- [ ] `node --check` 通过,`npm test` 保持通过。
