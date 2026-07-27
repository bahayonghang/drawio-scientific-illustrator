# Implement — MCP config writers

按 design.md 的模块顺序实现。全部文件在 `adapters/project-local/`。

## Checklist

### 组 1 — 条目真源

- [ ] `lib/mcp-entries.mjs`:`SERVERS` 常量 + `entriesFor({ platform, root, skillDir, pathStyle, absolute })`。
      路径一律正斜杠(design §2);claude 无 `cwd`,codex 有 `cwd`。

### 组 2 — Claude Code 写入器

- [ ] `lib/patch-mcp-json.mjs`:`patchMcpJson` / `removeMcpJson`(design §3)。
      等价判定、备份、原子写、未知字段保留、解析失败不覆盖。
- [ ] 验证:空项目 / 已有其它 servers / 同名等价 / 同名冲突四种手工场景。

### 组 3 — Codex 写入器

- [ ] `lib/patch-codex-config.mjs`:`patchCodexConfig` / `removeCodexConfig` /
      `readManagedProject`(design §4)。行扫描定位区块、区块外同名表头检测、
      `# project:` 绑定记录、CRLF 保持、BOM 去除、备份、原子写。
- [ ] 验证:空文件 / 已有用户 TOML / 区块外同名表头 / 重复执行 四种场景,
      项目级与用户级各跑一遍。

### 组 4 — 全局插件检测

- [ ] `lib/codex-plugin.mjs`:`detectGlobalPlugin()`(design §5),`codex` 缺失时降级不中止。

### 组 5 — 接缝落实

- [ ] `lib/mcp.mjs`:`writeMcpConfig` / `removeMcpConfig` 真实实现(design §6),
      codex 双写 + 单项目绑定保护 + #13025 说明输出。
- [ ] `install.mjs`:`--mcp-path-style` 参数、`excludeEntries()` 增量、清单
      `mcpConfig` / `userMcpConfig`、摘要文案(design §7)。**不改已有编排顺序。**

### 组 6 — 单测

- [ ] `tests/patch-mcp-json.test.mjs`:无文件、已有 servers 保留、同名等价复用、
      同名冲突退出 2 且原文件未动、非法 JSON 不覆盖、幂等。
- [ ] `tests/patch-codex-config.test.mjs`:空文件、已有用户 TOML 逐字节保留、
      区块外同名表头退出 2、区块删除、CRLF/LF 各一次、重复执行幂等、
      绑定到另一项目退出 2、`--force` 放行。
- [ ] `tests/mcp-entries.test.mjs`:四种路径形态的期望值(design §2 表)。
- [ ] **所有用户级测试通过 `CODEX_HOME` 指向临时目录**,断言真实
      `~/.codex/config.toml` 未被读写。夹具不得出现 `C:\Users` 字面量。

## 验证命令

```bash
node --check adapters/project-local/install.mjs
node --test "adapters/project-local/tests/*.test.mjs"
npm test
```

端到端(`CODEX_HOME` 指向临时目录,避免污染真实配置):

```bash
node adapters/project-local/install.mjs --project <tmp> --platform both --dry-run
node adapters/project-local/install.mjs --project <tmp> --platform both
node adapters/project-local/install.mjs --project <tmp2> --platform codex   # 期望退出 2:重绑定
node adapters/project-local/install.mjs --project <tmp2> --platform codex --force
```

## 审查门禁

- `npm test` 绿;单测全过。
- `--mcp none` 行为与子任务 2 完全一致(不触碰任何配置文件)。
- 冲突场景一律 exit 2 且**原文件逐字节未变**。
- 真实 `~/.codex/config.toml` 在整轮测试前后 mtime 与内容不变(显式核对一次)。
- 新增文件无本地绝对路径字面量。

## 回滚点

单独成串提交。配置文件的破坏面由 `.bak` 备份与"只动受控区块"兜底。
