# Project-local self-contained skill for dual platform

## Goal

把本仓库的 draw.io 科研绘图能力改造为**可安装到任意项目路径下的自包含 Skill 包**:
Skill 目录内置两个 MCP Server 脚本(`drawio-live` / `drawio-file-utils`),安装后不依赖本
fork 仓库路径即可运行;同时支持 Claude Code 与 Codex 两个平台;保留原全局 Codex 插件
安装方式不变,并保持后续从上游 `icebird1998/drawio-scientific-illustrator` 低冲突同步。

参考文档:`drawio-project-local-skill-execution-plan.md`(非约束草稿)。本 PRD 在其基础上
按用户 2026-07-26 的四项决策调整,冲突处以本 PRD 为准。

## 用户决策(2026-07-26,覆盖草稿文档默认值)

| 决策点 | 结论 | 与草稿文档的差异 |
|---|---|---|
| 目标平台 | **双平台:Claude Code + Codex** | 文档只针对 Codex 且明确"不增加 Claude Code 适配";本轮按用户要求做双平台 |
| 打包方式 | **自包含 Copy**:skill 目录内置 `scripts/`(两个 server + drawio-path),MCP 配置指向项目内脚本 | 文档推荐默认为 Link + GlobalRuntime;Link 模式本轮不做 |
| 安装器 | **Node 零依赖安装器**(`install.mjs` / `update.mjs` / `uninstall.mjs`),跨 Windows/macOS/Linux | 文档提议 PowerShell + Shell 双套;本轮不写 ps1/sh |
| 范围 | **按文档完整实施**:安装/更新/卸载/迁移/上游同步/测试/CI/文档全套 | 一致,但以任务树拆分交付 |

派生决策(由上述四项推出,详见父任务 design.md):

- MCP 作用域只支持 `project`(默认)与 `none`。文档中的 GlobalRuntime 模式与自包含 Copy
  语义冲突(全局配置绑定单项目路径),本轮移除。
- 上游同步脚本同样用 Node 实现(`scripts/sync-upstream.mjs`),不写 PowerShell 版。

## Requirements

### R1 自包含 Skill 包
- 安装到目标项目后,Skill 目录结构为:`SKILL.md` + `agents/openai.yaml` + `scripts/`
  (`live-server.mjs`、`server.mjs`、`drawio-path.mjs` 原样复制,零改动)。
- 安装完成后删除本 fork 仓库,目标项目内的 Skill 与两个 MCP 仍可正常工作。
- 不修改核心区文件:`plugins/**`、`install.ps1`、`install.sh`、`README.md`、
  `.agents/plugins/marketplace.json`。Skill 包在安装时从核心区**装配**而来,不在仓库内
  维护第二份拷贝。

### R2 双平台安装
- Claude Code:Skill 装入 `<Project>/.claude/skills/recreate-scientific-figure-in-drawio/`,
  MCP 写入项目根 `.mcp.json`。
- Codex:Skill 装入 `<Project>/.agents/skills/recreate-scientific-figure-in-drawio/`
  (`.agents/skills/` 已实测确认为 Codex 项目级发现目录)。
- Codex MCP **双写**(2026-07-27 决策,起因见下):项目级 `<Project>/.codex/config.toml`
  受控区块 + 用户级 `~/.codex/config.toml` 受控区块,两处内容一致。
- `--platform claude|codex|both|auto`,默认 `auto`(按项目内已有 `.claude/`/`.codex/`/
  `.agents/` 目录探测,探测不到时要求显式指定)。
- 两个 MCP Server 的名称(`drawio-live`、`drawio-file-utils`)与工具 Schema 不变。
- Claude Code 侧已知约束:`.mcp.json` 无 `cwd` 键,`args` 相对路径以 Claude Code 启动
  目录解析,故**必须从项目根启动 `claude`**;安装输出与文档需明说。
- Codex 侧已知限制:`mcp_servers` 的项目级配置在 codex-cli 0.145.0 上被完全忽略
  (上游 bug openai/codex#13025),用户级那一份才是今天真正生效的;因此 **Codex 上同一
  时间只能绑定一个项目**。安装第二个项目时必须检测到已有绑定、显式报告并要求 `--force`,
  不得静默重绑定。#13025 修复后限制自动消失。

### R3 安装生命周期
- `install.mjs`:环境检查 → 冲突检查 → 装配 Skill → 写 MCP 配置 → 写安装清单 → 验证。
  重复安装幂等。
- `update.mjs`:从当前 fork 重新装配,临时目录 + 原子替换,失败恢复旧目录;默认不
  `git pull`,可选 `--pull-source`(仅 ff-only)。
- `uninstall.mjs`:按清单删除 Skill、MCP 受控配置(含 `~/.codex/config.toml` 里的用户级
  受控区块)、git exclude 区块、清单本身;只删除清单记录的路径;路径被用户改为非本工具
  内容时中止并提示人工处理。
- 安装清单 `.agents/drawio-scientific-install.json` 记录来源 commit、平台、受控路径。

### R4 安全规则(继承草稿文档 §21.1)
- 所有配置写入前备份;临时文件 + 原子重命名;未知目录与未知同名配置不覆盖;
  同名 MCP 命令不同则中止;`--force` 只能覆盖清单记录的本工具内容。

### R5 全局插件迁移(仅 Codex)
- `--migrate-from-global-plugin` 显式触发:先装好项目级 Skill 与 MCP 并预验证,再
  `codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools`。
- 不删除 Marketplace 仓库目录;迁移不得造成 Skill 与 MCP 同时不可用。
- 双写决策后迁移的必要性上升:全局插件与我们写的用户级受控区块会用**同名** server
  (`drawio-live`/`drawio-file-utils`)。安装到 Codex 时若检测到全局插件仍在,必须报告
  这一重名并建议迁移或 `--mcp none`,不得静默产生两个来源。

### R6 上游同步
- `scripts/sync-upstream.mjs`:工作区不干净中止;`main` 仅 ff-only 合并 `upstream/main`;
  `dev` rebase `main` 后 `--force-with-lease` 推送;不用 `reset --hard`、不用裸 `--force`;
  rebase 冲突保留现场并输出处理说明。

### R7 测试与 CI
- `node --test` 单元测试覆盖 lib 模块;集成测试矩阵(临时目录模拟目标项目);
  全局污染检查(`$HOME` 下 skills 目录不得新增本 Skill)。
- `package.json` 增加 `test:project-local` 与 `test:all`;原 `npm test` 保持通过。
- GitHub Actions:Node 22 × (windows-latest, ubuntu-latest),跑 check + 适配器测试 +
  安装器 `--dry-run`;不做 CDP 端到端绘图。

### R8 文档(英文,仓库约定)
- `adapters/project-local/README.md`、`docs/project-local-install.md`、
  `docs/upstream-sync.md`、`docs/migration-from-global-plugin.md`、`README.dev.md`。

## 跨子任务验收标准(父任务集成评审用)

- [x] 在一个全新 Git 项目上 `install → 验证 → update → uninstall` 全链路幂等通过(双平台各一次)。
      证据:`07-26-docs-release/research/e2e.md` §1、§4、§5(实机 `--platform both`);
      幂等由 `integration.test.mjs` row 5 断言(重装后配置与 skill 文件逐字节不变)。
- [x] 卸载后目标项目无残留,且 `~/.codex/config.toml` 用户级区块移除、区块外逐字节不变。
      证据:e2e.md §5 —— 项目只剩 `.git/` 与 `README.md`,`git status --porcelain` 为空;
      真实用户配置 sha256 与安装前完全一致(`017c2bf5…`,17893 bytes)。
      **本条曾不成立**:卸载遗留 `~/.codex/config.toml.drawio-install.bak`,见 e2e.md §6,已修复
      (commit `21ba4c4`)并加回归测试。
- [x] `$HOME/.claude/skills`、`$HOME/.agents/skills`、`$HOME/.codex/skills` 无新增本 Skill。
      证据:e2e.md §8;`tests/check-global-pollution.mjs` 每次 `test:project-local` 兜底,
      且做过反向验证(伪造 HOME 时三条断言全部触发)。
- [x] `git diff upstream/main -- plugins/drawio-scientific-illustrator` 为空。
      2026-07-27 复核输出为空。
- [~] `npm test` 与 `npm run test:project-local` 全部通过(本地 Windows 72/72,含污染检查);
      **CI 双系统绿色待 push 后确认** —— 见下方"未完成项"。
- [~] Windows 实机端到端全流程可用;未安装项目中 Skill 不可见。
      证据:e2e.md §2(删除 fork 副本后仍完成 launch → 加节点/边 → fit → 截图 → 保存 →
      validate → 导出 PNG,PNG 实际渲染正确)、§3(Codex `debug prompt-input`:已安装项目从
      项目级路径解析该 Skill,未安装项目完全不列出)。
      **限定**:Codex 侧为实测;**Claude Code 侧未实机验证会话可见性**(无等价的零成本
      prompt dump 命令),仅验证了文件布局与 `.mcp.json` 内容正确。见 e2e.md §3 末尾。
- [x] 上游同步演练一次成功,同步后已安装项目不受影响。
      证据:`archive/2026-07/07-26-upstream-sync/research/verification.md` S1–S7
      (7 个场景,含冲突保留现场与 `--abort` 还原)。解耦性由 e2e.md §2 直接证明
      (fork 副本删除后安装仍完全可用)。**限定**:所有演练均带 `--no-push`,
      两条 push 语句尚未真实执行过。

### 未完成项(需用户决策)

- CI 双系统绿色:需 push `dev` 触发 `.github/workflows/project-local-adapter.yml`。
- 发布标签 `dev-project-local-v0.1.0`:按 D4 约定,创建与推送均需用户确认。

## 任务地图

| 顺序 | 子任务 | 交付物 | 前置 |
|---|---|---|---|
| 1 | 07-26-baseline-fork-docs | 基线冻结、README.dev.md、上游 remote 规范 | 无 |
| 2 | 07-26-installer-core | install.mjs + lib(根解析/装配/清单/exclude) | 1 |
| 3 | 07-26-mcp-config-writers | .mcp.json 与 config.toml 受控写入 + 冲突保护 | 2 |
| 4 | 07-26-lifecycle-migration | update / uninstall / 全局插件迁移 | 2、3 |
| 5 | 07-26-upstream-sync | sync-upstream.mjs | 1(可与 2-4 并行) |
| 6 | 07-26-tests-and-ci | 单测 + 集成矩阵 + npm scripts + CI | 2、3、4 |
| 7 | 07-26-docs-release | 全套文档 + Windows E2E + 发布标签 | 全部 |

## Notes

- 父任务不直接承载实现;每个子任务激活前需完成各自的 planning 工件
  (轻量子任务 PRD-only 即可,复杂子任务补 design.md + implement.md)。
- 仓库 gotcha:`scripts/validate-repo.mjs` 会扫描本地 Windows 绝对路径与凭据模式,新增
  适配器代码、测试夹具、文档中不得出现 `C:\Users\...` 类路径;基线子任务需确认其扫描
  范围是否覆盖 `adapters/`。
- 版本号本轮不动(`validate-repo.mjs:18` 硬编码 1.0.0);发布用 `dev-project-local-v0.1.0`
  git 标签,不改 plugin 版本。
