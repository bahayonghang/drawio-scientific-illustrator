# Design — Project-local self-contained skill (dual platform)

总体架构与跨子任务契约。各子任务的 design.md 只补充本任务内部细节,不得与本文冲突;
需要偏离时先回父任务改这里。

## 1. 仓库内新增目录(全部位于核心区之外)

```text
adapters/project-local/
├─ README.md                  # 适配器使用说明(英文)
├─ install.mjs                # 入口:node adapters/project-local/install.mjs ...
├─ update.mjs
├─ uninstall.mjs
├─ lib/
│  ├─ cli.mjs                 # 参数解析 + 统一日志/退出码(零依赖,手写)
│  ├─ project-root.mjs        # 目标项目根解析
│  ├─ skill-package.mjs       # 从核心区装配自包含 Skill 目录
│  ├─ install-manifest.mjs    # 清单读写(原子写、schema 校验)
│  ├─ patch-mcp-json.mjs      # Claude Code:项目根 .mcp.json
│  ├─ patch-codex-config.mjs  # Codex:.codex/config.toml 受控区块
│  ├─ git-exclude.mjs         # .git/info/exclude 受控区块
│  └─ verify-install.mjs      # 安装后验证
└─ tests/                     # node --test,*.test.mjs
scripts/sync-upstream.mjs     # 上游同步(独立于安装器)
docs/project-local-install.md
docs/upstream-sync.md
docs/migration-from-global-plugin.md
README.dev.md
.github/workflows/project-local-adapter.yml
```

核心区(`plugins/**`、根 `install.ps1`/`install.sh`、`README.md`、marketplace.json)零改动。
`package.json` 仅追加 scripts(`test:project-local`、`test:all`)。

## 2. 安装后的目标项目布局

Skill 包为**装配产物**:源 SKILL.md + agents/ 来自
`plugins/drawio-scientific-illustrator/skills/recreate-scientific-figure-in-drawio/`,
`scripts/` 三个 `.mjs` 来自 `plugins/drawio-scientific-illustrator/scripts/`,全部原样复制。
脚本只依赖 `node:` 内核模块,唯一跨文件导入是 `./drawio-path.mjs` 相对路径,复制后即可运行。

```text
<Project>/
├─ .claude/skills/recreate-scientific-figure-in-drawio/   # platform=claude 时
│  ├─ SKILL.md
│  ├─ agents/openai.yaml
│  └─ scripts/{live-server.mjs, server.mjs, drawio-path.mjs}
├─ .mcp.json                                              # platform=claude 时(项目根)
├─ .agents/skills/recreate-scientific-figure-in-drawio/   # platform=codex 时(同构)
├─ .codex/config.toml                                     # platform=codex 时(受控区块)
└─ .agents/drawio-scientific-install.json                 # 清单(所有平台共用一份)
```

决策:`both` 模式下每个平台各持一份 Skill 拷贝,各自的 MCP 配置指向各自拷贝。
备选方案(单拷贝 + 跨平台引用)被否:会让一个平台的卸载破坏另一个平台,且引入
链接语义(本轮已排除 Link)。约 1.7k 行脚本的重复体积可接受,update 统一刷新两份。

## 3. 安装器 CLI 契约

```text
node adapters/project-local/install.mjs
  --project <path>            # 必填
  --platform claude|codex|both|auto   # 默认 auto:按 .claude/.codex/.agents 目录探测,
                                      # 探测不到任何平台目录时中止并要求显式指定
  --mcp project|none          # 默认 project
  --migrate-from-global-plugin  # 仅 codex;显式迁移
  --track-in-git              # 不写 git exclude,让安装内容可提交
  --force                     # 仅覆盖清单记录的本工具内容
  --skip-verification
  --dry-run                   # 打印将执行的动作,不落盘(CI 用)
```

`update.mjs --project <path> [--pull-source]`、`uninstall.mjs --project <path>
[--remove-platform claude|codex|all]`。退出码:0 成功 / 1 环境或参数错误 / 2 冲突中止。

安装流程(草稿文档 §12 的 A-F 阶段保留):
环境检查(Node>=22、源文件存在、目标可写)→ 冲突检查 → 装配 Skill(临时目录 + 原子
rename)→ 写 MCP 配置 → 写 git exclude → 写清单 → 验证(`node --check` 三脚本、
配置可解析、路径存在)。

## 4. MCP 配置写入

### 4.1 Claude Code — `<Project>/.mcp.json`

JSON 读-改-写:保留未知字段与既有 servers,只增改 `drawio-live`、`drawio-file-utils` 两键。
`args` 使用**项目根相对路径**(`.claude/skills/.../scripts/live-server.mjs`),避免把机器
绝对路径写进可能被提交的文件。写前备份 `.mcp.json.bak`。

已验证约束(research/platform-mcp-behavior.md 第 1 项):`.mcp.json` stdio 条目**没有 `cwd`
键**,文档也未规定 `args` 相对路径的基准目录;实际以 Claude Code 的启动目录解析。
`${CLAUDE_PROJECT_DIR}` 只存在于被拉起的 server 环境里,不在 Claude Code 自身环境里,
写进 `.mcp.json` 必须带默认值(`${CLAUDE_PROJECT_DIR:-.}`),退化成 `.`,买不到任何东西。

因此:相对路径是唯一可提交的选项,代价是一条必须写进文档的约束 ——
**Claude Code 需从项目根启动**。安装器验证步骤按项目根解析路径并显式说明这一点。
提供 `--mcp-path-style relative|absolute` 逃生舱;选 `absolute` 时 `.mcp.json` 一并进
git exclude。

冲突规则:同名 server 已存在且命令等价 → 复用不动;不等价且非清单管理 → 退出码 2,
输出双方命令对比,绝不静默覆盖。

### 4.2 Codex — 双写(项目级 + 用户级)

**实测结论(research/platform-mcp-behavior.md 第 3b 项):codex-cli 0.145.0 完全忽略项目级
`.codex/config.toml` 里的 `mcp_servers`。** `codex mcp get` 查不到、`codex mcp list` 不列、
`codex exec` 实跑不拉起进程;标记项目为 `trust_level = "trusted"` 也无效。对应上游未修 bug
openai/codex#13025。`codex mcp add` 无 `--scope`,只写用户级。

用户决策(2026-07-27):**双写**。

1. **项目级** `<Project>/.codex/config.toml` 受控区块 —— 照规范写,当前无效,等 #13025
   修复后自动生效。Codex 配置分层里项目层优先于用户层且按键合并,同名 server 由项目层
   胜出,不会产生重复条目,自愈。
2. **用户级** `~/.codex/config.toml` 受控区块 —— 同名两条,让它今天就能用。

两处内容一致,均采用 Codex 支持的 `cwd` + `./`-相对 args 形式(上游全局插件本身就是这么
注册的,见 research 第 2 项):

```toml
# >>> drawio-scientific-illustrator managed block (project: <project-name>)
[mcp_servers."drawio-live"]
command = "node"
args = ["./scripts/live-server.mjs"]
cwd = "<abs path to that project's skill copy>"

[mcp_servers."drawio-file-utils"]
command = "node"
args = ["./scripts/server.mjs"]
cwd = "<abs path to that project's skill copy>"
# <<< drawio-scientific-illustrator managed block
```

**已知限制(必须写进文档与安装输出):Codex 上同一时间只能绑定一个项目。** server 名必须
保持 `drawio-live` / `drawio-file-utils`(SKILL.md 按名字调工具,Codex 工具名按 server 名
命名空间化),所以用户级那两条是全局单例。安装第二个项目会覆盖第一个项目的用户级绑定 ——
安装器必须检测受控区块里已记录的项目路径,不同则**显式报告将要重绑定并要求 `--force`**,
不静默覆盖。#13025 修复后此限制自动消失(项目层各自生效)。

用户级配置**是**用户设置,只在受控区块内增删;`uninstall` 两处都清。用户级路径是绝对路径,
但它落在 `~/.codex/config.toml`(本就机器本地、不进版本库),不违反"别把本地路径写进可提交
文件"的红线。

实现约束:区块外内容逐字节保留;冲突检测用手写 TOML 表头扫描(只需识别
`[mcp_servers."name"]` 表头,零依赖前提下不引入 TOML parser——比草稿文档建议的
"用 TOML Parser"降级,理由:仓库禁止依赖,且需求只是检测同名表头,不是通用 TOML 编辑);
UTF-8 无 BOM;保持原换行风格;写前备份。

### 4.3 研究项 —— 已结案

三项全部完成,证据与来源见
`.trellis/tasks/07-26-mcp-config-writers/research/platform-mcp-behavior.md`:

| 研究项 | 结论 | 影响 |
|---|---|---|
| Claude `.mcp.json` 路径基准 / `cwd` | 无 `cwd` 键;相对路径以启动目录为准 | §4.1 保持相对路径 + 新增启动目录约束与逃生舱 |
| Codex `mcp_servers` 的 `cwd` 与 args 基准 | 支持 `cwd`,args 相对 `cwd` | §4.2 采用 `cwd` + `./` 形式 |
| Codex 项目级 Skill 目录 | `.agents/skills/` 确认(实测) | §2 与 PRD R2 不变 |

额外发现(未在原研究项内,但改变了设计):Codex 项目级 MCP 不生效 → §4.2 改双写。

## 5. 安装清单 Schema(v2,扩展草稿文档 §11)

```json
{
  "schemaVersion": 2,
  "installedAt": "...", "updatedAt": "...",
  "sourceRepository": "bahayonghang/drawio-scientific-illustrator",
  "sourceCommit": "<sha>", "sourceBranch": "dev",
  "projectRoot": "<abs>",
  "mode": "copy",
  "platforms": {
    "claude": {
      "skillPath": ".claude/skills/recreate-scientific-figure-in-drawio",
      "mcpConfig": ".mcp.json", "mcpScope": "project"
    },
    "codex": {
      "skillPath": ".agents/skills/recreate-scientific-figure-in-drawio",
      "mcpConfig": ".codex/config.toml", "mcpScope": "project"
    }
  },
  "managedPaths": ["..."]
}
```

清单内路径一律存**项目根相对路径**(`projectRoot` 除外),避免项目整体移动后清单失效,
也避免测试夹具触发 validate-repo 的本地路径扫描。原子写:`.tmp` → rename。

## 6. Git exclude 受控区块

`.git/info/exclude` 追加(非 Git 项目跳过并提示):

```gitignore
# >>> drawio-scientific-illustrator local install
.claude/skills/recreate-scientific-figure-in-drawio/
.agents/skills/recreate-scientific-figure-in-drawio/
.agents/drawio-scientific-install.json
.mcp.json.bak
# <<< drawio-scientific-illustrator local install
```

按实际安装的平台生成条目;`--track-in-git` 时跳过 Skill 目录条目(清单与备份仍排除)。
`.mcp.json` 本体不排除(项目级 MCP 本就常被提交,且写的是相对路径;若研究项 4.3 迫使
使用绝对路径则改为排除)。

## 7. 更新与卸载

- update:重新装配到 `<skill>.tmp` → 校验 → 旧目录改名 `.backup` → rename → 删 `.backup`;
  任一步失败恢复 `.backup`。MCP 配置按当前设计重写受控部分;清单刷新 `sourceCommit`。
- uninstall:逐项对照清单;Skill 目录内容与"本工具装配产物"结构不符(出现未知顶层文件)
  时不删,列出差异让用户处理;MCP 只移除受控区块/受控键;exclude 只删受控区块。

## 8. 兼容性与回滚

- 原全局 Codex 插件安装方式不受影响;同一项目"全局插件 + 项目级安装"并存时 MCP 同名
  冲突由冲突检查按 4.1/4.2 规则报告,迁移路径见 R5。
- 回滚 = uninstall + (可选)重装全局插件,草稿文档 §21.3 命令仍适用。
- 上游同步:所有新增文件在核心区之外,rebase 冲突面限定在 `package.json` 一处追加。
