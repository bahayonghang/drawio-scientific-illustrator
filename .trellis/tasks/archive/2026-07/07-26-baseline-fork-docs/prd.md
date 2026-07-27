# Baseline freeze and fork docs

父任务:`07-26-project-local-skill`(需求与架构见父任务 prd.md / design.md)。
前置:无。任务性质:轻量,PRD-only 可激活。

## Goal

冻结改造前基线,确认核心区与上游一致,并补齐 fork 开发说明,使后续子任务有可回退、
可对照的起点。

## Requirements

- 确认/配置 git remotes:`origin` = bahayonghang fork,`upstream` = icebird1998;缺
  `upstream` 时添加并 `git fetch upstream --prune`。
- 验证 `git diff upstream/main -- plugins/drawio-scientific-illustrator` 为空;不为空时
  停止并上报,不得自行"修复"核心区。
- 运行 `npm test` 并将结果(通过项、Node 版本、commit sha)记录到本任务 `research/`。
- 阅读 `scripts/validate-repo.mjs`,确认其本地路径/凭据扫描是否覆盖将来新增的
  `adapters/`、`docs/`、`README.dev.md`;结论写入 `research/`(直接影响子任务 2/6/7 的
  文件内容红线)。
- 新增 `README.dev.md`(英文):fork 用途、分支职责(main 镜像上游 / dev 承载改造)、
  上游同步入口(指向 docs/upstream-sync.md,占位链接即可)、项目级安装入口占位。
- 不修改 `README.md` 与任何核心区文件。

## Acceptance Criteria

- [ ] `git remote -v` 显示 origin/upstream 符合预期,且已 fetch。
- [ ] 核心区 diff 为空的证据(命令输出)存入 `research/baseline.md`。
- [ ] `npm test` 基线结果与 validate-repo 扫描范围结论存入 `research/baseline.md`。
- [ ] `README.dev.md` 提交到 dev,`npm test` 仍通过。
