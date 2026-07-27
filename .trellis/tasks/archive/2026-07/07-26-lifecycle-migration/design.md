# Design — Update, uninstall, migration

补充父任务 `design.md` §7 的实现细节。前置产物:子任务 2 的装配/清单/exclude 模块,
子任务 3 的 `writeMcpConfig` / `removeMcpConfig`。

## 0. 先修一个前序缺陷:备份文件名与 Codex 自身约定撞名

子任务 3 的写入器用 `<file>.bak` 做备份。`~/.codex/` 下 **Codex 自己就用这个名字**
(实测该目录里有 `config.toml.bak`、`hooks.json.bak`、`hooks.json.bak-codux-stale-…`、
`config.toml.bak.2026-06-08T…`)。继续沿用会**覆盖用户的 Codex 备份** —— 尤其 uninstall
若再去删 `.bak`,等于删掉不属于我们的文件。

改动:备份后缀统一为 `.drawio-install.bak`,由 `lib/backup.mjs` 导出

```js
export const BACKUP_SUFFIX = ".drawio-install.bak";
export function backupPathFor(file);
```

`patch-mcp-json.mjs` / `patch-codex-config.mjs` 改用它;`install.mjs` 的 exclude 条目
从 `.mcp.json.bak` 改为 `.mcp.json.drawio-install.bak`,并加
`.codex/config.toml.drawio-install.bak`。这是本任务的**第一步**,先于 update/uninstall。

## 1. 新增文件

```text
adapters/project-local/
├─ update.mjs
├─ uninstall.mjs
└─ lib/
   ├─ backup.mjs        # §0
   ├─ installed.mjs     # 读清单 + 解析已安装平台(update/uninstall 共用)
   └─ migrate.mjs       # 全局插件迁移
```

## 2. `lib/installed.mjs`

```js
export function loadInstalled(projectInput) -> { root, isGitRepo, manifest, platforms }
```

`resolveProjectRoot` → `readManifest`;清单缺失 → `ExitError(1, "No install manifest
found in <root>; nothing to update/uninstall.")`(uninstall 侧改为返回 null 以保持幂等,
见 §4)。`platforms` = `Object.keys(manifest.platforms)`。

## 3. `update.mjs`

```text
node adapters/project-local/update.mjs
  --project <path>        # 必填
  --pull-source           # 先在 fork 仓库执行 git pull --ff-only
  --force                 # 允许覆盖被用户改过的 skill 目录
  --skip-verification
  --dry-run
```

流程:

```text
A  loadInstalled()                     # 无清单 → exit 1
B  assertSourcesPresent()              # fork 源文件齐全
C  --pull-source ? pullSource() : skip # §3.1
D  每平台:describeInstalled().unknownTop 非空且无 --force → exit 2,列出差异
E  每平台:assembleSkill()              # 已是 tmp → backup → rename → 失败恢复(子任务 2 §5.2)
F  writeMcpConfig()                    # 按清单里的 mcpScope / mcpPathStyle 重写受控部分
G  writeManifest()                     # 刷新 sourceCommit / sourceBranch / updatedAt
H  verifyInstall()
```

D 步是关键防线:`assembleSkill` 会整目录替换,用户若在 skill 目录里加了自己的文件,
默认必须中止而不是静默吞掉。`--force` 才放行(此时 `.backup-<pid>` 仍在替换失败时兜底)。

MCP 重写使用清单里记录的 `mcpScope` 与 `claude.mcpPathStyle`,**不重新探测**——update
不应改变用户当初选的形态。Codex 用户级重绑保护照旧生效:清单里的 `projectRoot` 与受控
区块记录一致时是幂等刷新,不会触发 rebind 分支。

### 3.1 `--pull-source`

在 **fork 仓库**(`paths.repoRoot`)执行,不是目标项目:

1. `git status --porcelain` 非空 → `ExitError(1, "The fork checkout has uncommitted changes…")`。
2. 当前分支必须是 `dev` → 否则 `ExitError(1)`,打印实际分支。
3. `git pull --ff-only origin dev`,失败原样透传 stderr 并 `ExitError(1)`。

不做 `--force`、不做 `reset --hard`(父 PRD R6 的安全基调)。

## 4. `uninstall.mjs`

```text
node adapters/project-local/uninstall.mjs
  --project <path>                       # 必填
  --remove-platform claude|codex|all     # 默认 all
  --dry-run
```

流程:

```text
A  loadInstalled();清单缺失 → 打印 "nothing to uninstall" 并 exit 0（幂等）
B  targets = --remove-platform 解析后与清单交集
C  每个 target:
     describeInstalled(skillDir)
       - 不存在        → 跳过
       - unknownTop 空 → rmSync(skillDir, recursive)
       - unknownTop 非空 → **跳过并 warn**,列出未知文件,提示人工处理
D  removeMcpConfig({ platforms: targets })   # 子任务 3 已保证只动受控区块;
                                             # 用户级区块绑定给别的项目时会自动跳过并 warn
E  删除本工具的备份文件(仅 §0 的 .drawio-install.bak 后缀,只删受控配置对应的那几个)
F  剩余平台为空 ?
     → removeExcludeBlock()、删除清单、删除空的 .agents/ 目录(若已空)
     → 否则:重写清单(去掉 targets)、按剩余平台刷新 exclude 区块
G  摘要:实际删了什么、跳过了什么、为什么
```

**只删清单记录过的路径**(父 PRD R3)。C 步的"跳过不删"优先于"干净卸载"——用户数据不可
牺牲。空目录清理只对 `.agents/`、`.claude/skills/`、`.agents/skills/` 这几层,且仅在
`readdirSync` 为空时删,绝不递归删除。

## 5. `lib/migrate.mjs` 与 `--migrate-from-global-plugin`

参数挂在 **install.mjs** 上(父 PRD R5)。

```js
export function planMigration({ platforms }) -> { applicable, reason }
export function removeGlobalPlugin({ dryRun }) -> { removed, output }
```

约束与顺序:

1. `platforms` 不含 `codex` → `ExitError(1, "--migrate-from-global-plugin only applies
   to the codex platform.")`,在参数解析后立即检查,**不做任何安装**。
2. `detectGlobalPlugin()`:
   - `available === false`(codex CLI 不存在)→ `ExitError(1)`,明确说明找不到 `codex`。
   - `installed === false` → `log.info("Global plugin is not installed; nothing to
     migrate.")`,安装照常进行,不报错。
3. 安装与验证**全部成功之后**才执行
   `codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools`。
   `--skip-verification` 与 `--migrate-from-global-plugin` 同时给出 → `ExitError(1)`:
   迁移的前提是预验证,不允许跳过。
4. `--dry-run` 只打印将执行的命令。
5. 移除失败 → 不回滚安装(项目级已经可用),打印手工命令,`ExitError(1)`。
6. 不删除 Marketplace 仓库目录(父 PRD R5)。

移除成功后打印新会话验证指引:重开 Codex 会话、`codex mcp list` 应只剩项目级绑定的两条。

## 6. 本任务不做

- 测试矩阵与 CI(子任务 6);本任务补 update/uninstall 的单测。
- 文档(子任务 7)。
