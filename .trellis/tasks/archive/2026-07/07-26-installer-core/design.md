# Design — Installer core

补充父任务 `design.md` §1/§2/§3/§5/§6 的实现细节。与父任务冲突时以父任务为准。
本任务只交付 `--mcp none` 可用的完整安装链路;`--mcp project` 的实际写入由子任务 3 接管。

## 1. 模块与职责

```text
adapters/project-local/
├─ install.mjs             # 编排:parseArgs → 各阶段 → 汇报
└─ lib/
   ├─ cli.mjs              # 参数解析、日志、ExitError
   ├─ paths.mjs            # 仓库根/源目录定位(脚本自身位置推导)
   ├─ project-root.mjs     # 目标项目根解析
   ├─ platform.mjs         # platform 探测与归一
   ├─ skill-package.mjs    # 装配 + 原子替换
   ├─ install-manifest.mjs # 清单读写
   ├─ git-exclude.mjs      # .git/info/exclude 受控区块
   ├─ mcp.mjs              # 子任务 3 的接缝;本任务内 writeMcpConfig/removeMcpConfig 为 no-op
   └─ verify-install.mjs   # 安装后验证
```

零依赖、ESM `.mjs`、`node:` 前缀导入、2 空格、双引号、分号。

## 2. 公共约定

### 2.1 退出码与错误

`cli.mjs` 导出 `ExitError extends Error { code }`。`install.mjs` 顶层 catch:
`ExitError` → 打印 `message` 并 `process.exit(code)`;其他异常 → 栈 + `exit(1)`。

- `0` 成功(含幂等无变更)
- `1` 环境/参数错误(Node 版本、源缺失、路径不可写、参数非法)
- `2` 冲突中止(未知同名 Skill 目录、同名 MCP 不等价、Codex 用户级已绑定别的项目)

### 2.2 日志

`log.step(msg)` / `log.info` / `log.warn` / `log.ok` / `log.plan(action)`。
`--dry-run` 下所有写操作改走 `log.plan`,函数签名不变(各写入模块接受 `{ dryRun }`)。
无颜色、无 emoji、无外部依赖 —— 输出会被 CI 抓取。

### 2.3 路径规范化

`paths.normalize(p)`:`~` 展开 → `path.resolve` → Windows 盘符大写归一
(`c:\x` → `C:\x`)。清单与比较一律用归一后的值。项目内路径一律存
`path.posix` 风格的相对路径(`toPosix(path.relative(root, abs))`),跨平台可比较。

## 3. `lib/paths.mjs` — 源定位

```js
export const adapterDir;   // 本文件所在目录的上级 = adapters/project-local
export const repoRoot;     // adapterDir/../..
export const sourceRoot;   // repoRoot/plugins/drawio-scientific-illustrator
export const SOURCE_FILES; // 见 §5.1
export function assertSourcesPresent();  // 缺任一文件 → ExitError(1)
```

全部由 `fileURLToPath(import.meta.url)` 推导,**不出现任何绝对路径字面量**。

## 4. `lib/project-root.mjs`

```js
export function resolveProjectRoot(input) -> { root, isGitRepo }
```

1. `input` 必填(`--project`),归一化。
2. 不存在 → `ExitError(1, "Project path does not exist: …")`;
   是文件 → `ExitError(1, …)`;不可写(`fs.accessSync(W_OK)`)→ `ExitError(1, …)`。
3. 从 `input` 向上找 `.git`(**目录或文件** —— worktree/submodule 是文件),找到则
   该目录为 `root`、`isGitRepo = true`。
4. 找不到 `.git` → `root = input`、`isGitRepo = false`(非 Git 项目允许安装)。

注意:向上查找可能把 `root` 抬到 `input` 之上。若 `root !== input`,打印
`Resolved project root: <root> (from <input>)`,让用户看得见。

## 5. `lib/skill-package.mjs`

### 5.1 复制清单(固定,不做目录遍历)

| 源(相对 `sourceRoot`) | 目标(相对 skill 目录) |
|---|---|
| `skills/recreate-scientific-figure-in-drawio/SKILL.md` | `SKILL.md` |
| `skills/recreate-scientific-figure-in-drawio/agents/openai.yaml` | `agents/openai.yaml` |
| `scripts/live-server.mjs` | `scripts/live-server.mjs` |
| `scripts/server.mjs` | `scripts/server.mjs` |
| `scripts/drawio-path.mjs` | `scripts/drawio-path.mjs` |

三个脚本原样复制:唯一跨文件导入是 `./drawio-path.mjs`(已核实,`live-server.mjs:9`、
`server.mjs:9`),其余全是 `node:` 内核模块,复制即可运行。

固定清单而非递归拷贝的理由:上游若新增无关文件不会被静默带入,装配产物结构可预测
(uninstall 靠"未知顶层文件"判定用户是否手改过)。

### 5.2 装配与原子替换

```js
export async function assembleSkill({ skillDir, dryRun }) -> { written: string[] }
```

1. `tmp = skillDir + ".tmp-" + process.pid`,存在则先删(只删自己刚建的 tmp)。
2. 逐项复制到 `tmp`,`mkdir -p` 中间目录。
3. 对 `tmp/scripts/*.mjs` 跑 `node --check`(`execFileSync(process.execPath,
   ["--check", file])`),任一失败 → 删 `tmp` 并 `ExitError(1)`。
4. `skillDir` 已存在(且已通过 §6 冲突检查)→ 改名 `skillDir + ".backup-" + pid`。
5. `fs.renameSync(tmp, skillDir)`。
6. 成功 → 删 `.backup-*`;任一步抛错 → 恢复 `.backup-*` 后重抛。

`tmp` 与 `skillDir` 同父目录,保证 rename 是同卷原子操作。

### 5.3 结构指纹

```js
export function describeInstalled(skillDir) -> { files: string[], unknownTop: string[] }
```

列出 skill 目录里的文件(相对路径,posix),`unknownTop` = 不在 §5.1 目标清单里的条目。
供冲突检查与后续 update/uninstall 判定"是否本工具装配产物"。

## 6. 冲突检查(装配之前)

对每个目标平台的 `skillDir`:

| 现状 | 行为 |
|---|---|
| 不存在 | 正常安装 |
| 存在,清单记录了它,且 `unknownTop` 为空 | 幂等覆盖(重装) |
| 存在,清单没记录 | `ExitError(2)` —— 未知同名 Skill 目录,`--force` **也不放行** |
| 存在,清单记录了但 `unknownTop` 非空 | `ExitError(2)`,列出未知文件;`--force` 放行 |

父 PRD R4:`--force` 只能覆盖清单记录的本工具内容。

## 7. `lib/install-manifest.mjs`

Schema v2 见父 design.md §5。

```js
export function readManifest(root) -> manifest | null   // 非法 JSON → ExitError(1)
export function writeManifest(root, manifest, { dryRun })
export function manifestPath(root)  // .agents/drawio-scientific-install.json
```

- 原子写:`.tmp` → `renameSync`。
- 读到 `schemaVersion` 缺失或 `< 2` → 就地升级(补 `platforms` 结构),不报错。
- `schemaVersion > 2` → `ExitError(1, "manifest written by a newer installer")`。
- `platforms` 按平台合并:本次只安装 `claude` 时不动 `codex` 条目。
- 路径字段全部为项目根相对 posix 路径(`projectRoot` 除外)。

## 8. `lib/git-exclude.mjs`

```js
export function applyExcludeBlock(root, lines, { dryRun })
export function removeExcludeBlock(root, { dryRun })
```

- `isGitRepo === false` → 跳过 + `log.warn("Not a Git repository; skipping .git/info/exclude")`。
- 区块标记见父 design.md §6。已有区块 → 整块替换;无 → 追加(前面补一个空行)。
- 区块外内容逐字节保留;文件不存在则创建;保持原换行风格(检测首个 `\r\n`)。
- `.git` 是文件(worktree)时读其中的 `gitdir:` 指向再定位 `info/exclude`。

## 9. `lib/verify-install.mjs`

```js
export async function verifyInstall({ root, manifest }) -> { ok, problems: string[] }
```

1. 每个平台的 skill 目录存在且 §5.1 五个文件齐全。
2. 三个脚本 `node --check` 通过。
3. `spawn(process.execPath, [liveServerPath])`,发 `initialize` + `tools/list`,
   断言 tools 非空,8 s 超时后 kill —— 与仓库既有 `scripts/smoke-test.mjs` 同款做法。
   只对 `live-server.mjs` 做,`server.mjs` 留给子任务 6 的集成测试,避免安装耗时翻倍。
4. `--skip-verification` 跳过全部。

失败 → 打印 problems + `ExitError(1)`;**不自动回滚**(安装产物留在原地便于排查),
但明确提示 `uninstall.mjs`。

## 10. `install.mjs` 编排

```text
A  parseArgs                     → cli.mjs
B  assertNodeVersion(>=22)       → process.versions.node
C  assertSourcesPresent()        → paths.mjs
D  resolveProjectRoot()          → project-root.mjs
E  resolvePlatforms()            → platform.mjs
F  readManifest()                → install-manifest.mjs
G  冲突检查(每平台)              → §6
H  assembleSkill(每平台)         → skill-package.mjs
I  writeMcpConfig()              → mcp.mjs（本任务 no-op）
J  applyExcludeBlock()           → git-exclude.mjs
K  writeManifest()               → install-manifest.mjs
L  verifyInstall()               → verify-install.mjs
M  摘要输出(含 Claude 需从项目根启动的约束提示)
```

`--dry-run` 在 A-G 全部真实执行,H-L 只 `log.plan`。

### 10.1 `lib/platform.mjs`

```js
export function resolvePlatforms(input, root) -> ("claude"|"codex")[]
```

`claude`/`codex` → 单元素;`both` → 两个;`auto` → 探测:
`.claude/` 存在 → claude;`.codex/` 或 `.agents/` 存在 → codex;
两者都无 → `ExitError(1, "Cannot detect platform; pass --platform claude|codex|both")`。

平台 → 路径映射(父 design.md §2):

| platform | skillDir |
|---|---|
| claude | `.claude/skills/recreate-scientific-figure-in-drawio` |
| codex | `.agents/skills/recreate-scientific-figure-in-drawio` |

## 11. 本任务不做

- 任何 MCP 配置文件写入(子任务 3)。
- `update.mjs` / `uninstall.mjs` / 迁移(子任务 4)。
- 完整测试矩阵与 CI(子任务 6);本任务只随手写核心 lib 的单测骨架。
- `--mcp-path-style`(属于 MCP 写入,子任务 3)。
