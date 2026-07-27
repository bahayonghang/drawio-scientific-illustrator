# Implement — 父任务执行计划(任务树编排)

父任务不直接写代码;本文件定义子任务的执行顺序、门禁与集成评审。子任务各自的
implement.md 承载文件级 checklist。

## 执行顺序与门禁

```text
[1] 07-26-baseline-fork-docs        (轻量,PRD-only 可激活)
     └─ 门禁:npm test 基线通过;git diff upstream/main -- plugins/ 为空;
              validate-repo.mjs 扫描范围结论写入 research/
[2] 07-26-installer-core            (复杂,需 design.md + implement.md)
     └─ 门禁:install --dry-run 与实际安装在临时项目通过;重复安装幂等;npm test 仍绿
[3] 07-26-mcp-config-writers        (复杂,需 design.md + implement.md;含研究项 4.3)
     └─ 门禁:双平台配置写入/复用/冲突中止三类场景在测试中覆盖
[4] 07-26-lifecycle-migration       (复杂,需 design.md + implement.md)
     └─ 门禁:install → update → uninstall 全链路无残留;迁移流程 dry-run 通过
[5] 07-26-upstream-sync             (轻量,PRD-only 可激活;可与 2-4 并行)
     └─ 门禁:脏工作区/不可 ff 两种中止路径有测试或演练记录
[6] 07-26-tests-and-ci              (依赖 2-4 产出;补齐矩阵 + CI)
     └─ 门禁:npm run test:all 本地绿;CI windows+ubuntu 绿
[7] 07-26-docs-release              (最后;含 Windows 实机 E2E)
     └─ 门禁:父任务 prd.md 跨子任务验收清单全部勾选
```

## 每个子任务的通用约束

- 激活前:按 Trellis 1.1-1.4 完成该子任务 planning 工件并 `task.py start <child>`。
- 提交:工作在 `dev` 或 `feat/*`;信息为英文祈使句(仓库约定,无 Conventional 前缀)。
- 每次提交前:`npm test`(原有)必须通过;新增文件不得包含本地绝对路径。
- 代码风格:ESM `.mjs`、2 空格、双引号、分号、`node:` 前缀导入、零依赖。

## 验证命令(全局)

```bash
npm test                       # 原有 check + smoke
npm run test:project-local     # 子任务 6 之后可用
node adapters/project-local/install.mjs --project <tmp> --platform both --dry-run
```

## 回滚点

- 每个子任务单独成串提交,可按子任务整体 revert。
- 安装器对目标项目的破坏面由清单 + 备份文件兜底(design.md §7)。
- 上游同步演练放在最后(子任务 7),失败可 `git rebase --abort` 后重试。

## 集成评审(父任务收尾)

1. 逐项核对父 prd.md「跨子任务验收标准」。
2. `git log upstream/main..dev -- plugins/` 确认核心区零功能改动。
3. 归档全部子任务后归档父任务,打 `dev-project-local-v0.1.0` 标签(草稿,待用户确认推送)。
