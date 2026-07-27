# Update uninstall and global-plugin migration

父任务:`07-26-project-local-skill`。前置:07-26-installer-core、07-26-mcp-config-writers。
任务性质:复杂 —— 激活前需补本任务 design.md + implement.md。

## Goal

补齐安装生命周期:`update.mjs`(从当前 fork 原子化重装配)、`uninstall.mjs`(清单驱动
的安全卸载)、`--migrate-from-global-plugin`(Codex 全局插件显式迁移)。

## Requirements

### update.mjs
- 读取清单 → 定位 fork 源 → 校验源文件齐全 → 对清单中每个平台拷贝执行
  `.tmp` 装配 → 校验 → 旧目录 `.backup` → rename → 删 `.backup`;任一步失败恢复
  `.backup`(父 design.md §7)。
- 刷新 MCP 受控配置与清单 `sourceCommit`/`updatedAt`。
- 默认不 `git pull`;`--pull-source` 仅在工作区干净、当前分支 dev 时执行
  `git pull --ff-only origin dev`,否则中止(草稿文档 §13)。
- Skill 目录已被用户手改(与装配产物结构不符)时中止并列出差异,不静默覆盖。

### uninstall.mjs
- 逐项对照清单删除:各平台 Skill 目录、MCP 受控配置(调用子任务 3 的 `remove()`)、
  exclude 受控区块、清单本身、`.bak` 备份。
- `--remove-platform claude|codex|all`(默认 all);只删一个平台时清单保留另一平台条目。
- 清单记录的路径已变成非本工具内容时跳过该项并输出人工处理提示,其余照常;
  卸载幂等(重复执行退出 0)。

### 迁移(install.mjs 的 --migrate-from-global-plugin,仅 platform 含 codex 时有效)
- 顺序:检测全局插件(`codex plugin list`)→ 项目级安装 + 预验证 → 通过后才执行
  `codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools` → 输出
  新会话验证指引(草稿文档 §10)。
- 预验证失败则不移除插件;不删除 Marketplace 仓库目录;`codex` CLI 不存在时给出
  明确错误而非崩溃。

## Acceptance Criteria

- [ ] install → update(源 commit 变化后)→ uninstall 全链路在临时项目通过,卸载后
      目标项目与安装前 diff 为空(双平台各跑一次)。
- [ ] update 中途失败注入(如篡改临时目录权限/预置 .tmp)可恢复旧拷贝。
- [ ] 用户手改 Skill 目录后 update/uninstall 均中止或跳过,不丢用户数据。
- [ ] 迁移流程在无 codex CLI、插件未安装、插件已安装三种环境下行为正确
      (无 CLI → 报错;未安装 → 提示跳过;已安装 → dry-run 记录动作序列)。
- [ ] `npm test` 保持通过。
