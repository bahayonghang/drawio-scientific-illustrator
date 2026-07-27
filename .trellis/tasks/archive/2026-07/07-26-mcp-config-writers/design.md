# Design — MCP config writers

补充父任务 `design.md` §4 的实现细节。研究结论见本任务
`research/platform-mcp-behavior.md`,与父任务冲突时以父任务为准。

## 1. 新增模块

```text
adapters/project-local/lib/
├─ mcp.mjs                 # 已存在的接缝;本任务填实现
├─ mcp-entries.mjs         # 两个 server 条目的唯一真源(名称 / 脚本 / 路径样式)
├─ patch-mcp-json.mjs      # Claude Code: <Project>/.mcp.json
├─ patch-codex-config.mjs  # Codex: 项目级与用户级 config.toml 通用
└─ codex-plugin.mjs        # 全局插件共存检测
```

## 2. `lib/mcp-entries.mjs` — 条目真源

```js
export const SERVERS = [
  { name: "drawio-live", script: "scripts/live-server.mjs" },
  { name: "drawio-file-utils", script: "scripts/server.mjs" },
];
export function entriesFor({ platform, root, skillDir, pathStyle }) -> [{ name, command, args, cwd }]
```

server 名固定为 `drawio-live` / `drawio-file-utils` —— SKILL.md 按名字末尾匹配工具,
改名会让 Skill 失效(父 PRD R2)。

路径形态按平台分工(研究结论):

| 平台                               | 形态                                                   | 值                                              |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| claude, `pathStyle=relative`(默认) | 无 `cwd`,`args` 为项目根相对 posix 路径                | `.claude/skills/<name>/scripts/live-server.mjs` |
| claude, `pathStyle=absolute`       | 无 `cwd`,`args` 为绝对 posix 路径                      | `C:/…/scripts/live-server.mjs`                  |
| codex,项目级                       | `cwd` 为项目根相对路径,`args` 为 `./scripts/…`         | `cwd = "./.agents/skills/<name>"`               |
| codex,用户级                       | `cwd` 为**绝对**路径(别无选择),`args` 为 `./scripts/…` | `cwd = "C:/…/.agents/skills/<name>"`            |

**所有路径一律用正斜杠**,包括 Windows。Node 在 Windows 上接受正斜杠,而 TOML 基本字符串
里的反斜杠需要转义 —— 用正斜杠把整类转义问题消掉。

Codex 项目级的相对 `cwd` 是一个**未经验证的赌注**:该功能今天完全不生效(研究 3b),
无从测起。#13025 修复后必须重新验证一次;若届时相对 `cwd` 不成立,改绝对路径并把
项目级 `.codex/config.toml` 加进 git exclude。design 里显式记下这笔待办。

## 3. `lib/patch-mcp-json.mjs`

```js
export function patchMcpJson({ file, entries, manifest, force, dryRun }) -> { changed, reused }
export function removeMcpJson({ file, names, dryRun }) -> { changed }
```

- 文件不存在 → 以 `{ "mcpServers": {} }` 起步。
- 解析失败 → `ExitError(1)`,**不覆盖**,提示先修复文件。
- 未知顶层字段与其它 server 原样保留;只碰 `mcpServers` 下那两个键。
- 写前备份 `<file>.bak`(仅在文件已存在时)。原子写:`.tmp` → rename。
- 缩进固定 2 空格,尾随换行 —— 与 `plugins/…/.mcp.json` 现状一致。

### 3.1 冲突规则

| 现状                                       | 行为                                                    |
| ------------------------------------------ | ------------------------------------------------------- |
| 键不存在                                   | 写入                                                    |
| 键存在,内容与将写入的**完全等价**          | 复用,不改文件(`reused`)                                 |
| 键存在,内容不等价,且清单记录过本工具写过它 | 覆盖(这是 update 的正常路径)                            |
| 键存在,内容不等价,清单没记录               | `ExitError(2)`,打印双方 `command` + `args` + `cwd` 对比 |

等价 = `command` 相同 且 `args` 数组逐项相同 且 `cwd` 相同(两边都缺视为相同)。

## 4. `lib/patch-codex-config.mjs`

同一实现服务项目级与用户级两个文件,差异只在 `file` 与条目的 `cwd` 形态。

```js
export function patchCodexConfig({ file, entries, projectRoot, force, dryRun }) -> { changed, rebindFrom }
export function removeCodexConfig({ file, dryRun }) -> { changed }
export function readManagedProject(file) -> string | null
```

### 4.1 受控区块格式

```toml
# >>> drawio-scientific-illustrator managed block
# project: C:/path/to/project
[mcp_servers."drawio-live"]
command = "node"
args = ["./scripts/live-server.mjs"]
cwd = "C:/path/to/project/.agents/skills/recreate-scientific-figure-in-drawio"

[mcp_servers."drawio-file-utils"]
command = "node"
args = ["./scripts/server.mjs"]
cwd = "C:/path/to/project/.agents/skills/recreate-scientific-figure-in-drawio"
# <<< drawio-scientific-illustrator managed block
```

`# project:` 注释行是**绑定记录**,`readManagedProject()` 靠它判断当前用户级配置绑给了谁
(父 design.md §4.2 的单项目绑定保护)。放在区块内,uninstall 一并删掉。

### 4.2 手写 TOML 处理(不引入 parser)

零依赖约束下只做三件事,都用行扫描:

1. **定位区块**:`# >>> …` / `# <<< …` 两行之间。
2. **区块外同名表头检测**:逐行匹配
   `/^\s*\[mcp_servers\.(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\]\s*$/`,
   命中 `drawio-live` / `drawio-file-utils` 且不在区块内 → `ExitError(2)`。
   这是**检测**,不是通用 TOML 编辑 —— 需求只到这里(父 design.md §4.2)。
3. **整块替换/追加/删除**:区块外内容逐字节保留。

已知局限,写进注释与文档:多行数组里若出现形似 `[mcp_servers."x"]` 的字符串会被误判为表头。
代价是误报中止(安全方向),不是静默破坏,可接受。

### 4.3 单项目绑定保护(仅用户级)

`readManagedProject(userConfig)` 的返回值:

| 值                       | 行为                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `null`(无区块)           | 正常写入                                                                                                                                         |
| 等于当前 `projectRoot`   | 幂等刷新                                                                                                                                         |
| 指向别的项目             | `ExitError(2)`:`Codex's drawio MCP servers are currently bound to <A>. Installing here would rebind them to <B>. Re-run with --force to rebind.` |
| 指向别的项目 + `--force` | 整块替换,并打印重绑定摘要                                                                                                                        |

路径比较用 `paths.normalize()` 后的值。

### 4.4 文件写入细节

- UTF-8 无 BOM;读到 BOM 则去掉再写回(不保留 —— Codex TOML 不该有 BOM)。
- 换行风格:检测原文首个 `\r\n` 决定,新文件用 `\n`。
- 写前备份 `<file>.bak`;原子写 `.tmp` → rename。
- 用户级文件路径:`process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex")` 下的
  `config.toml`。**测试必须通过 `CODEX_HOME` 重定向**,不得碰真实用户配置
  (父 PRD R7 全局污染检查)。
- 用户级目录不存在时创建;用户级文件不存在时以空内容起步。

## 5. `lib/codex-plugin.mjs`

```js
export function detectGlobalPlugin() -> { installed: boolean, available: boolean }
```

`execFileSync("codex", ["plugin", "list"])`,输出含 `drawio-scientific-illustrator`
即视为已安装。`codex` 不存在(ENOENT)→ `{ installed: false, available: false }`,
**只提示不中止**。

install 时若 `installed` 为真且平台含 codex:打印警告 —— 全局插件与我们写的用户级区块会
注册同名 server,建议 `--migrate-from-global-plugin`(子任务 4)或 `--mcp none`。
警告不中止:两者命令不同但工具集相同,实际表现是其中一个被 Codex 忽略,不构成数据风险。

## 6. `lib/mcp.mjs` — 真实实现

```js
export function writeMcpConfig({ scope, root, platforms, skillDirs, manifest, pathStyle, force, dryRun })
  -> { changed: string[], reused: string[], warnings: string[] }
export function removeMcpConfig({ root, platforms, manifest, dryRun }) -> { changed: string[] }
```

`scope === "none"` → 直接返回空结果(保持子任务 2 的行为)。

`scope === "project"`,按平台:

- `claude` → `patchMcpJson({ file: <root>/.mcp.json, … })`
- `codex` → `patchCodexConfig` **两次**:
  1. `<root>/.codex/config.toml`(相对 `cwd`)
  2. `<CODEX_HOME>/config.toml`(绝对 `cwd`,带绑定保护)
     写完打印:`Codex project-level MCP config is not loaded by codex-cli today
(openai/codex#13025); the user-level entry is what makes it work.`

调用点签名在子任务 2 已固定,**install.mjs 只需新增 `--mcp-path-style` 参数透传**,
其余编排不动。

## 7. install.mjs 的增量改动

1. SPEC 增加 `--mcp-path-style relative|absolute`(默认 `relative`,仅影响 claude)。
2. `excludeEntries()` 增加 `.codex/config.toml.bak`;`pathStyle === "absolute"` 时
   追加 `.mcp.json`(父 design.md §6 的条件分支)。
3. 清单 `platforms[*].mcpConfig` 写真实路径;codex 额外记 `userMcpConfig`
   (`CODEX_HOME/config.toml` 的绝对路径),供 uninstall 定位。
4. 摘要输出:claude 的启动目录约束(已有)+ codex 的双写说明与单项目绑定提示。

## 8. 本任务不做

- `update.mjs` / `uninstall.mjs` 的编排(子任务 4);本任务只提供 `remove*()` 函数并保证
  它们只动受控内容。
- 迁移流程(子任务 4)。
- 完整测试矩阵(子任务 6);本任务补两个 patcher 的单测。
