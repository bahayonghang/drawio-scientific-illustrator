# Docs and release validation

父任务:`07-26-project-local-skill`。前置:全部子任务(1-6)完成。
任务性质:轻量偏文档,PRD-only 可激活;但含一次 Windows 实机端到端验证,须留证据。

## Goal

补齐项目级适配器的全套英文文档,在 Windows 实机跑通"安装 → 使用 → 更新 → 卸载"
端到端验证与隔离性检查,逐项核对父任务的跨子任务验收标准,最后打发布标签。

## Requirements

### D1 文档(英文,仓库约定;不改 `README.md` 与核心区)

- `adapters/project-local/README.md` —— 适配器自身说明:CLI 契约(install/update/
  uninstall 全部参数与退出码)、目录产物、清单位置、故障排查。
- `docs/project-local-install.md` —— 面向使用者的安装指南:前置条件(Node >= 22、
  draw.io Desktop)、双平台安装示例、`--platform auto` 探测规则、安装后如何验证
  Skill 可见与 MCP 可用、常见冲突(同名 Skill 目录 / 同名 MCP)的处理。
- `docs/upstream-sync.md` —— `scripts/sync-upstream.mjs` 用法、分支职责
  (main 镜像上游 / dev 承载改造)、冲突处理步骤。
- `docs/migration-from-global-plugin.md` —— Codex 全局插件 → 项目级安装的迁移流程、
  预验证含义、回滚(重装全局插件)命令。
- `README.dev.md` —— 由子任务 1 创建;本任务把其中的占位链接替换为上述真实文档路径。
- 所有文档不得出现本地绝对路径(`C:\Users\...` 等),示例路径用 `<Project>` 占位或
  相对路径(`scripts/validate-repo.mjs` 红线)。

### D2 Windows 实机端到端验证(在真实项目中手工执行,记录到 `research/e2e.md`)

- 选一个全新的本地 Git 项目作为目标,`--platform both --mcp project` 安装。
- Claude Code 新会话:Skill 可见;`drawio_live_launch` → `graph_ready=true` →
  加节点/边 → 截图 → 保存 → `validate` → 导出 PNG 全流程可用。
- Codex 新会话:Skill 可见,两个 MCP Server 可连接(至少 `tools/list` 有响应)。
- 隔离性:另一个**未安装**的项目中该 Skill 不可见。
- 删除本 fork 仓库副本(或临时改名)后,已安装项目仍能正常启动两个 Server —— 验证
  自包含 Copy 模式成立。
- `update` 一次(源 commit 变化后)与 `uninstall` 一次,确认卸载后目标项目与安装前
  `git status` 一致、无残留。

### D3 全局污染复核

- 端到端验证前后快照 `$HOME/.claude/skills`、`$HOME/.agents/skills`、
  `$HOME/.codex/skills`,断言未新增 `recreate-scientific-figure-in-drawio`;
  结果记入 `research/e2e.md`。

### D4 集成评审与发布

- 逐项核对父任务 `prd.md`「跨子任务验收标准」7 条,勾选并在本任务记录证据来源。
- `git diff upstream/main -- plugins/drawio-scientific-illustrator` 为空。
- 版本号不动(`validate-repo.mjs:18` 硬编码 `1.0.0`,`package.json` / `plugin.json` /
  `CHANGELOG.md` 均不改);发布仅用 git 标签 `dev-project-local-v0.1.0`。
- 标签**创建与推送前需用户确认**,不自行 push。

## Acceptance Criteria

- [x] 四份新文档 + `README.dev.md` 链接更新全部提交(commit `535dcdf`),参数逐条对照
      三个 `--help` 输出核对。E2E 推翻了初稿里"全部内容都进 exclude、`git status` 保持干净"
      的说法,已改正(见 research/e2e.md §7)。
- [x] `npm test` 与 `npm run test:all` 通过(72/72);`validate-repo.mjs` 对新增文档无告警
      (文档已扫描无 `C:\Users\...` 字面量)。
- [x] `research/e2e.md` 记录 D2 全部步骤实际结果、隔离性验证、删除 fork 后仍可用的证据。
- [x] D3 全局污染复核为"无新增",记录在 e2e.md §8。
- [~] 父任务 7 条已逐条标注证据位置;其中 2 条带限定:CI 双绿待 push,
      Claude Code 会话可见性未实机验证(仅 Codex 侧实测)。
- [ ] 标签 `dev-project-local-v0.1.0`:待用户拍板,尚未创建。

## 本任务发现的缺陷(已修复,记录以备回溯)

- `uninstall.mjs` 卸载后遗留 `~/.codex/config.toml.drawio-install.bak`,
  归属子任务 4。由子任务 6 的全局污染守卫在实机 E2E 中抓到。
  修复 commit `21ba4c4` + 回归测试。详见 research/e2e.md §6。
- 文档初稿关于 exclude 覆盖范围的描述有误(代码正确、文档错误),已改正。

## Notes

- 本任务只写文档与验证,不改适配器代码;若 E2E 暴露缺陷,回相应子任务修复
  (滚回 Phase 1/2),不在本任务内打补丁。
- 文档语言:英文(仓库约定);现有 `README.md`/`PRIVACY.md` 的双语风格不适用于新文档。
