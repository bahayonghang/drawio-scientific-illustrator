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

冲突规则:同名 server 已存在且命令等价 → 复用不动;不等价且非清单管理 → 退出码 2,
输出双方命令对比,绝不静默覆盖。

### 4.2 Codex — `<Project>/.codex/config.toml`

受控区块(沿用草稿文档 §9.3):

```toml
# >>> drawio-scientific-illustrator managed block
[mcp_servers."drawio-live"]
command = "node"
args = ["<project-relative-or-absolute per research>/scripts/live-server.mjs"]
# <<< drawio-scientific-illustrator managed block
```

实现约束:区块外内容逐字节保留;冲突检测用手写 TOML 表头扫描(只需识别
`[mcp_servers."name"]` 表头,零依赖前提下不引入 TOML parser——比草稿文档建议的
"用 TOML Parser"降级,理由:仓库禁止依赖,且需求只是检测同名表头,不是通用 TOML 编辑);
UTF-8 无 BOM;保持原换行风格;写前备份。

### 4.3 研究项(mcp-config-writers 子任务启动前必须落到 research/)

- Claude Code `.mcp.json` 中相对路径的解析基准(项目根?启动目录?)——决定 4.1 用
  相对还是绝对路径;若必须绝对路径,则该文件必须进 git exclude 且文档标注不可提交。
- Codex `mcp_servers` 是否支持 `cwd` 键、args 相对路径基准。
- Codex 项目级 Skill 发现目录究竟是 `.agents/skills/` 还是其他(草稿文档断言,未验证);
  验证不通过则调整 R2 的 Codex 安装路径。

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
