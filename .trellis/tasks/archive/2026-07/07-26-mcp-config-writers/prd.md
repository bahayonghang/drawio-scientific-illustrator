# MCP config writers for Claude Code and Codex

父任务:`07-26-project-local-skill`。前置:07-26-installer-core。
任务性质:复杂 —— 激活前需补本任务 design.md + implement.md,且必须先完成研究项。

## Goal

实现 `--mcp project` 路径:向目标项目写入两个 MCP Server(`drawio-live`、
`drawio-file-utils`)的项目级配置 —— Claude Code 写项目根 `.mcp.json`,Codex 写
`.codex/config.toml` 受控区块 —— 并接入 install.mjs 的 `writeMcpConfig` 调用点。

## 研究项 —— 已于 2026-07-27 结案

全部结论与证据见 `research/platform-mcp-behavior.md`,父 design.md §4 已按结论改写。摘要:

- Claude Code `.mcp.json` **无 `cwd` 键**,`args` 相对路径以 Claude Code 启动目录解析。
  → 用项目根相对路径(唯一可提交的选项),文档写明"从项目根启动";逃生舱
  `--mcp-path-style absolute` 时把 `.mcp.json` 加进 git exclude。
- Codex `mcp_servers` **支持 `cwd`**,args 相对 `cwd` 解析(上游全局插件即如此注册)。
- Codex 项目级 Skill 目录 **`.agents/skills/` 实测确认**,无需改安装路径。
- **Codex 项目级 `mcp_servers` 被完全忽略**(codex-cli 0.145.0,上游 bug
  openai/codex#13025;trust_level 无关)。→ 用户决策:**双写**,详见父 design.md §4.2。

## Requirements

- `lib/patch-mcp-json.mjs`:读-改-写,保留未知字段与既有 servers;同名冲突规则与备份
  策略遵守父 design.md §4.1;文件不存在时创建;JSON 解析失败时中止不覆盖。
- `lib/patch-codex-config.mjs`:受控区块写入/替换/删除,区块外逐字节保留;同名
  `[mcp_servers."..."]` 表头出现在区块外时退出 2;UTF-8 无 BOM、保持换行风格、写前备份
  (父 design.md §4.2)。同一实现同时用于**项目级** `<Project>/.codex/config.toml` 与
  **用户级** `~/.codex/config.toml`(双写),两处内容一致、`cwd` 均为该项目 skill 拷贝的
  绝对路径。
- 用户级双写的单项目绑定保护:写 `~/.codex/config.toml` 前解析受控区块里已记录的项目
  路径;若已绑定到**另一个**项目,退出 2 并报告"将把 Codex 的 drawio MCP 从 A 重绑定到
  B",仅 `--force` 放行。绑定到同一项目则幂等刷新。
- 全局插件共存检测:若 `codex plugin list` 显示 `drawio-scientific-illustrator` 仍安装,
  报告同名 server 双来源风险,建议 `--migrate-from-global-plugin` 或 `--mcp none`
  (父 PRD R5)。`codex` CLI 不存在时降级为提示,不中止。
- 两个 server 的配置内容以清单中的 skillPath 为准生成,`drawio-live` → `scripts/live-server.mjs`,
  `drawio-file-utils` → `scripts/server.mjs`,名称与脚本对应关系不得改变。
- uninstall 语义预留:两个 patcher 均提供 `remove()`,只动受控内容(供子任务 4 调用)。
- 幂等:重复写入不产生重复条目/区块,内容无变化时不改文件 mtime(或至少字节一致)。

## Acceptance Criteria

- [x] 研究项结论 + 引用来源存入 `research/platform-mcp-behavior.md`,父 design.md §4
      已按结论改写(2026-07-27)。
- [ ] Claude:空项目、已有其他 servers、同名等价、同名冲突四种场景行为正确(冲突退出 2
      且原文件未动)。
- [ ] Codex:空 config.toml、已有用户配置、区块外同名表头、重复执行四种场景行为正确
      (项目级与用户级各跑一遍)。
- [ ] 用户级单项目绑定:绑定到 A 后再装 B 退出 2 并报告重绑定;`--force` 放行且 A 的
      受控区块被干净替换,区块外内容逐字节不变。
- [ ] `~/.codex/config.toml` 的测试全部在重定向的 `CODEX_HOME`/临时 HOME 下进行,
      真实用户配置不被测试触碰(与 R7 全局污染检查一致)。
- [ ] CRLF 与 LF 文件各验证一次,换行风格保持。
- [ ] `install --mcp project --platform both` 端到端产出双平台配置;`--mcp none` 不触碰
      任何配置文件。
- [ ] `npm test` 保持通过。
