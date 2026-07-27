# MCP config writers for Claude Code and Codex

父任务:`07-26-project-local-skill`。前置:07-26-installer-core。
任务性质:复杂 —— 激活前需补本任务 design.md + implement.md,且必须先完成研究项。

## Goal

实现 `--mcp project` 路径:向目标项目写入两个 MCP Server(`drawio-live`、
`drawio-file-utils`)的项目级配置 —— Claude Code 写项目根 `.mcp.json`,Codex 写
`.codex/config.toml` 受控区块 —— 并接入 install.mjs 的 `writeMcpConfig` 调用点。

## 研究项(启动实现前完成,结论持久化到 research/,必要时回改父 design.md §4)

- Claude Code `.mcp.json`:项目级发现机制、`args` 相对路径解析基准、是否支持 `cwd`。
  决定写相对路径还是绝对路径;绝对路径方案需联动 git-exclude 排除 `.mcp.json`。
- Codex:`mcp_servers` TOML 结构、`cwd` 支持、项目级 `.codex/config.toml` 是否被读取、
  项目级 Skill 发现目录是否为 `.agents/skills/`(草稿文档断言未验证;若不成立,
  Codex 侧 Skill 安装路径需回改父 design.md §2 并同步子任务 2)。
- 渠道:官方文档(context7 / WebFetch),不要凭记忆。

## Requirements

- `lib/patch-mcp-json.mjs`:读-改-写,保留未知字段与既有 servers;同名冲突规则与备份
  策略遵守父 design.md §4.1;文件不存在时创建;JSON 解析失败时中止不覆盖。
- `lib/patch-codex-config.mjs`:受控区块写入/替换/删除,区块外逐字节保留;同名
  `[mcp_servers."..."]` 表头出现在区块外时退出 2;UTF-8 无 BOM、保持换行风格、写前备份
  (父 design.md §4.2)。
- 两个 server 的配置内容以清单中的 skillPath 为准生成,`drawio-live` → `scripts/live-server.mjs`,
  `drawio-file-utils` → `scripts/server.mjs`,名称与脚本对应关系不得改变。
- uninstall 语义预留:两个 patcher 均提供 `remove()`,只动受控内容(供子任务 4 调用)。
- 幂等:重复写入不产生重复条目/区块,内容无变化时不改文件 mtime(或至少字节一致)。

## Acceptance Criteria

- [ ] 研究项三条结论 + 引用来源存入 research/,父 design.md §4.3 相应更新或确认。
- [ ] Claude:空项目、已有其他 servers、同名等价、同名冲突四种场景行为正确(冲突退出 2
      且原文件未动)。
- [ ] Codex:空 config.toml、已有用户配置、区块外同名表头、重复执行四种场景行为正确。
- [ ] CRLF 与 LF 文件各验证一次,换行风格保持。
- [ ] `install --mcp project --platform both` 端到端产出双平台配置;`--mcp none` 不触碰
      任何配置文件。
- [ ] `npm test` 保持通过。
