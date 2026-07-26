# Draw.io Scientific Illustrator 项目级 Skill 改造执行计划

> 目标仓库：`bahayonghang/drawio-scientific-illustrator`  
> 上游仓库：`icebird1998/drawio-scientific-illustrator`  
> 开发分支：`dev`  
> 适用环境：Codex Desktop / Codex CLI，Windows 优先，兼顾 macOS 与 Linux  
> 核心要求：不改变原始绘图设计，不修改核心 MCP 与 Draw.io Graph API 逻辑，Skill 安装在项目目录中，不占用全局 Skills，并保持后续从上游拉取更新的低冲突能力。

---

## 1. 最终交付形态

改造完成后，仓库保留原有全局插件安装方式，同时增加一套独立的项目级安装方式。

目标项目安装后的结构：

```text
<ProjectRoot>/
├─ .agents/
│  ├─ skills/
│  │  └─ recreate-scientific-figure-in-drawio/
│  │     └─ SKILL.md
│  └─ drawio-scientific-install.json
├─ .codex/
│  └─ config.toml                       # 仅 Project MCP 模式使用
└─ ...
```

推荐默认组合：

```text
Skill 安装方式：Link
Skill 作用域：项目级 Repo Scope
MCP 作用域：GlobalRuntime
原 Codex 全局插件：移除
原 drawio-live / drawio-file-utils：保持不变
```

含义：

- Skill 仅在目标项目内可见；
- 全局 Skills 目录不出现该 Skill；
- MCP Server 可以全局注册，供多个项目共享；
- 原始实时 Draw.io 绘制逻辑不变；
- fork 更新后，Link 模式项目自动使用新版 Skill 和脚本。

---

## 2. 改造边界

### 2.1 允许新增或修改

建议只在 `dev` 分支新增以下内容：

```text
adapters/codex-project-local/
scripts/sync-upstream.ps1
scripts/sync-upstream.sh
docs/project-local-install.md
docs/upstream-sync.md
docs/migration-from-global-plugin.md
README.dev.md
package.json                         # 仅增加测试命令时修改
```

### 2.2 原则上不修改

```text
plugins/drawio-scientific-illustrator/scripts/live-server.mjs
plugins/drawio-scientific-illustrator/scripts/server.mjs
plugins/drawio-scientific-illustrator/scripts/drawio-path.mjs
plugins/drawio-scientific-illustrator/skills/**
plugins/drawio-scientific-illustrator/.mcp.json
plugins/drawio-scientific-illustrator/.codex-plugin/plugin.json
install.ps1
install.sh
README.md
.agents/plugins/marketplace.json
```

这些文件属于上游核心区。适配层不直接改动它们，降低后续 rebase 冲突。

### 2.3 本轮不做

- 不合并 `drawio-live` 和 `drawio-file-utils`；
- 不重写 MCP Server；
- 不切换 MCP SDK；
- 不修改工具名称或参数 Schema；
- 不改变 Chrome DevTools Protocol 连接方式；
- 不增加 Claude Code 适配；
- 不做远程 Draw.io Desktop Bridge；
- 不改变原仓库插件市场和全局安装体验。

这些内容可以放到后续版本，不与本轮“项目级 Skill 安装”混合。

---

## 3. 分支与同步策略

### 3.1 分支职责

| 分支 | 用途 | 约束 |
|---|---|---|
| `upstream/main` | 原作者最新代码 | 只读 |
| `origin/main` | fork 的上游镜像 | 不放自定义提交 |
| `origin/dev` | 长期改造分支 | 所有项目级适配改动 |
| `feat/*` | 单项开发分支 | 完成后合并到 `dev` |

### 3.2 本地远程检查

```powershell
git remote -v
```

预期：

```text
origin    https://github.com/bahayonghang/drawio-scientific-illustrator.git
upstream  https://github.com/icebird1998/drawio-scientific-illustrator.git
```

缺少 `upstream` 时执行：

```powershell
git remote add upstream https://github.com/icebird1998/drawio-scientific-illustrator.git
git fetch upstream --prune
```

### 3.3 日常开发流程

```powershell
git switch dev
git pull --ff-only origin dev
git switch -c feat/project-local-installer
```

开发完成后：

```powershell
git add adapters docs scripts package.json
git commit -m "feat(project-local): add project-scoped skill installer"
git push -u origin feat/project-local-installer
```

通过 PR 合并到 `dev`，不要直接向 `main` 提交。

### 3.4 上游同步流程

```powershell
git status --short
git fetch upstream --prune

git switch main
git merge --ff-only upstream/main
git push origin main

git switch dev
git rebase main
git push --force-with-lease origin dev
```

同步脚本必须满足：

- 工作区不干净时中止；
- `main` 不能 fast-forward 时中止；
- 不执行 `git reset --hard`；
- 不执行普通 `--force`；
- rebase 冲突时保留现场并输出处理说明。

---

## 4. 目标目录设计

在 `dev` 中新增：

```text
adapters/
└─ codex-project-local/
   ├─ README.md
   ├─ install.ps1
   ├─ update.ps1
   ├─ uninstall.ps1
   ├─ install.sh
   ├─ update.sh
   ├─ uninstall.sh
   ├─ lib/
   │  ├─ project-root.mjs
   │  ├─ install-manifest.mjs
   │  ├─ patch-codex-config.mjs
   │  ├─ git-exclude.mjs
   │  └─ verify-install.mjs
   └─ tests/
      ├─ project-local-install.test.mjs
      ├─ config-patch.test.mjs
      └─ manifest.test.mjs
```

Windows 是首要验证环境。Shell 版本可以在 PowerShell 版本稳定后补齐。

---

## 5. 安装器接口设计

### 5.1 PowerShell 参数

```powershell
./adapters/codex-project-local/install.ps1 \
  -ProjectPath "D:\Projects\example" \
  -SkillMode Link \
  -McpScope GlobalRuntime
```

建议参数：

```powershell
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,

  [ValidateSet("Link", "Copy")]
  [string]$SkillMode = "Link",

  [ValidateSet("GlobalRuntime", "Project", "None")]
  [string]$McpScope = "GlobalRuntime",

  [switch]$MigrateFromGlobalPlugin,
  [switch]$Force,
  [switch]$SkipVerification
)
```

### 5.2 参数语义

| 参数 | 行为 |
|---|---|
| `ProjectPath` | 目标项目绝对路径或可解析路径 |
| `SkillMode=Link` | 创建 Junction/Symbolic Link 指向 fork 中的原始 Skill |
| `SkillMode=Copy` | 把 Skill 和必要运行时复制到项目内 |
| `McpScope=GlobalRuntime` | MCP 写入 Codex 用户级配置，但不安装全局 Skill |
| `McpScope=Project` | MCP 写入目标项目 `.codex/config.toml` |
| `McpScope=None` | 只安装 Skill，不配置 MCP |
| `MigrateFromGlobalPlugin` | 显式移除原全局 Codex 插件，再注册 MCP |
| `Force` | 修复或覆盖本工具已管理的内容，不覆盖非本工具内容 |
| `SkipVerification` | 跳过运行后验证，仅用于调试 |

---

## 6. 项目根目录解析

`project-root.mjs` 负责规范化目标路径。

识别优先级：

```text
显式 ProjectPath
    ↓
向上查找 .git 目录或 .git 文件
    ↓
找不到时使用 ProjectPath 本身
```

处理要求：

- 转换为绝对路径；
- 解析 `~`；
- Windows 统一处理盘符大小写；
- 不要求目标项目必须是 Git 仓库；
- 路径不存在时中止；
- 路径为文件时中止；
- 检查目标目录可写。

输出对象：

```json
{
  "requestedPath": "D:\\Projects\\example\\subdir",
  "projectRoot": "D:\\Projects\\example",
  "isGitRepository": true
}
```

---

## 7. Skill 安装方式

### 7.1 Link 模式

源目录：

```text
<fork-root>/plugins/drawio-scientific-illustrator/
  skills/recreate-scientific-figure-in-drawio
```

目标目录：

```text
<ProjectRoot>/.agents/skills/
  recreate-scientific-figure-in-drawio
```

Windows 执行策略：

```text
目录 Junction
    ↓ 失败
目录 SymbolicLink
    ↓ 失败
给出 Copy 模式提示并中止
```

PowerShell 核心命令：

```powershell
New-Item \
  -ItemType Junction \
  -Path $TargetSkillPath \
  -Target $SourceSkillPath
```

Link 模式安装前检查：

- 源目录存在；
- 源目录含 `SKILL.md`；
- 目标路径不存在，或已经是指向相同源的链接；
- 已存在普通目录时不得静默删除；
- `Force` 只能替换由安装清单记录的旧链接。

Link 模式更新：

- 不复制文件；
- 校验链接仍有效；
- 校验目标仍指向当前 fork；
- 更新安装清单中的源 Commit；
- 重新执行 MCP 路径校验。

### 7.2 Copy 模式

复制 Skill：

```text
<fork-root>/plugins/.../skills/recreate-scientific-figure-in-drawio
    ↓
<ProjectRoot>/.agents/skills/recreate-scientific-figure-in-drawio
```

复制插件运行时：

```text
<fork-root>/plugins/drawio-scientific-illustrator
    ↓
<ProjectRoot>/.agents/tools/drawio-scientific-illustrator/plugin
```

Copy 模式不要只复制三个 `.mjs` 文件。复制完整插件目录可以兼容上游后续增加资源、脚本或配置文件。

更新采用临时目录和原子替换：

```text
复制到 .tmp
运行校验
旧目录改名为 .backup
.tmp 改名为正式目录
删除 .backup
```

中间失败时恢复旧目录。

---

## 8. Git 排除策略

Link 模式默认不修改项目的 `.gitignore`，而是修改：

```text
<ProjectRoot>/.git/info/exclude
```

加入受控区块：

```gitignore
# >>> drawio-scientific-illustrator local install
.agents/skills/recreate-scientific-figure-in-drawio/
.agents/drawio-scientific-install.json
# <<< drawio-scientific-illustrator local install
```

若项目不是 Git 仓库：

- 不创建 `.git`；
- 不创建 `.gitignore`；
- 只提示这些文件属于本地安装内容。

Copy 模式增加参数决定是否提交：

```powershell
-TrackInGit
```

未传入时仍写入 `.git/info/exclude`；传入时不排除 `.agents/skills` 与 `.agents/tools`。

---

## 9. MCP 配置设计

### 9.1 保持原始双 Server

不得合并或改名：

```text
drawio-live
drawio-file-utils
```

源脚本：

```text
plugins/drawio-scientific-illustrator/scripts/live-server.mjs
plugins/drawio-scientific-illustrator/scripts/server.mjs
```

### 9.2 GlobalRuntime 模式

适用于 Codex Desktop 和多个项目共享。

推荐通过 Codex CLI 注册：

```powershell
codex mcp add drawio-live -- \
  node "<absolute-path>/scripts/live-server.mjs"

codex mcp add drawio-file-utils -- \
  node "<absolute-path>/scripts/server.mjs"
```

安装器流程：

```text
检查 codex CLI
检查 node
读取 codex mcp list --json
检查同名 Server
不存在则添加
存在且命令一致则保持
存在但命令不同则中止并给出冲突信息
```

不得在没有用户显式确认的情况下替换同名 MCP。

GlobalRuntime 模式只占用全局 MCP，不占用全局 Skill。

### 9.3 Project 模式

写入：

```text
<ProjectRoot>/.codex/config.toml
```

受控区块：

```toml
# >>> drawio-scientific-illustrator managed block

[mcp_servers."drawio-live"]
command = "node"
args = ["D:\\Tools\\drawio-scientific-illustrator\\plugins\\drawio-scientific-illustrator\\scripts\\live-server.mjs"]
cwd = "D:\\Tools\\drawio-scientific-illustrator\\plugins\\drawio-scientific-illustrator"

[mcp_servers."drawio-file-utils"]
command = "node"
args = ["D:\\Tools\\drawio-scientific-illustrator\\plugins\\drawio-scientific-illustrator\\scripts\\server.mjs"]
cwd = "D:\\Tools\\drawio-scientific-illustrator\\plugins\\drawio-scientific-illustrator"

# <<< drawio-scientific-illustrator managed block
```

`patch-codex-config.mjs` 必须：

- 保留文件中其他 TOML 内容；
- 只替换受控区块；
- 检测用户已存在同名配置；
- 同名配置位于受控区块外时中止；
- 写入前创建备份；
- UTF-8 无 BOM；
- 保持原换行风格；
- 不使用简单字符串替换处理任意 TOML 结构。

推荐使用 TOML Parser 进行冲突检测，受控区块用于稳定写回和卸载。

### 9.4 None 模式

只安装 Skill 与清单，不操作 MCP。

用于：

- MCP 已由用户自行配置；
- 只测试 Skill 发现机制；
- 目标项目通过其他客户端启动 MCP。

---

## 10. 从全局插件迁移

原全局插件安装后会同时加载 Skill 和 MCP。要实现真正的项目级 Skill，应移除原插件。

迁移必须显式触发：

```powershell
./install.ps1 \
  -ProjectPath "D:\Projects\example" \
  -SkillMode Link \
  -McpScope GlobalRuntime \
  -MigrateFromGlobalPlugin
```

迁移流程：

```text
检测插件安装状态
记录原 MCP 可用性
安装项目级 Skill
配置新的 MCP Scope
运行预验证
移除全局插件
启动新会话验证
迁移完成
```

推荐顺序是先准备新路径，再移除旧插件，降低中断风险。

移除命令：

```powershell
codex plugin remove \
  drawio-scientific-illustrator@drawio-scientific-tools
```

安装器不得删除 Marketplace 仓库目录，因为用户可能仍需要对比、更新或回滚。

迁移后的检查：

```text
codex plugin list 中插件为未安装
目标项目 Skill 可见
其他项目中 Skill 不可见
两个 MCP Server 可用
实时 Draw.io 流程正常
```

---

## 11. 安装清单

每个目标项目创建：

```text
.agents/drawio-scientific-install.json
```

建议 Schema：

```json
{
  "schemaVersion": 1,
  "installedAt": "2026-07-25T00:00:00.000Z",
  "updatedAt": "2026-07-25T00:00:00.000Z",
  "sourceRepository": "bahayonghang/drawio-scientific-illustrator",
  "upstreamRepository": "icebird1998/drawio-scientific-illustrator",
  "sourceBranch": "dev",
  "sourceRoot": "D:\\Tools\\drawio-scientific-illustrator",
  "sourceCommit": "<git-sha>",
  "projectRoot": "D:\\Projects\\example",
  "skill": {
    "name": "recreate-scientific-figure-in-drawio",
    "mode": "link",
    "sourcePath": "D:\\Tools\\...\\skills\\recreate-scientific-figure-in-drawio",
    "targetPath": "D:\\Projects\\example\\.agents\\skills\\recreate-scientific-figure-in-drawio"
  },
  "mcp": {
    "scope": "global-runtime",
    "servers": [
      "drawio-live",
      "drawio-file-utils"
    ]
  },
  "managedPaths": [
    ".agents/skills/recreate-scientific-figure-in-drawio"
  ]
}
```

清单用途：

- 识别路径是否由本工具管理；
- 支持安全更新；
- 支持安全卸载；
- 记录源 Commit；
- 防止 `Force` 删除用户文件；
- 判断共享 MCP 是否应保留。

---

## 12. install.ps1 实施步骤

按以下顺序实现：

### 阶段 A：环境检查

```text
定位适配器目录
定位 fork 根目录
读取 git 分支和 Commit
检查 Node.js >= 22
检查源 SKILL.md
检查两个 MCP 脚本
检查目标项目可写
检查已有安装清单
```

输出诊断示例：

```text
Repository root : D:\Tools\drawio-scientific-illustrator
Source branch   : dev
Source commit   : abcdef1
Project root    : D:\Projects\example
Skill mode      : Link
MCP scope       : GlobalRuntime
Node.js         : v22.x
Codex CLI       : available
```

### 阶段 B：冲突检查

检测：

- 目标 Skill 路径；
- 安装清单；
- `.codex/config.toml` 同名配置；
- 全局同名 MCP；
- 原全局插件；
- 旧版本适配器安装。

冲突必须明确区分：

```text
已由本工具安装，可更新
存在相同配置，可复用
存在未知目录，不可覆盖
存在同名但不同 MCP，不可自动替换
```

### 阶段 C：创建 Skill

- 创建 `.agents/skills`；
- Link 或 Copy；
- 校验 `SKILL.md`；
- 写入 Git exclude。

### 阶段 D：配置 MCP

- GlobalRuntime / Project / None；
- 检测并处理同名配置；
- 不覆盖未知配置。

### 阶段 E：写清单

使用临时文件：

```text
drawio-scientific-install.json.tmp
    ↓ fsync/close
rename
```

### 阶段 F：验证

- 检查目标 Skill；
- 检查源路径；
- 检查 MCP 配置；
- 执行 `node --check`；
- 执行仓库现有 `npm run check`；
- 输出下一步操作：重启 Codex 或新建会话。

---

## 13. update.ps1 实施步骤

调用示例：

```powershell
./adapters/codex-project-local/update.ps1 \
  -ProjectPath "D:\Projects\example"
```

流程：

```text
读取安装清单
定位源仓库
校验源分支和文件
读取当前源 Commit
检查安装模式
Link：修复/校验链接
Copy：安全同步插件和 Skill
刷新 MCP 路径
更新清单
运行验证
```

默认不执行 `git pull`。更新器只从当前本地 fork 同步到目标项目。

提供可选参数：

```powershell
-PullSource
```

传入时仅允许：

```text
工作区干净
当前分支为 dev
执行 git pull --ff-only origin dev
```

不要在 `update.ps1` 中自动 rebase 上游。上游同步由独立脚本处理。

---

## 14. uninstall.ps1 实施步骤

调用示例：

```powershell
./adapters/codex-project-local/uninstall.ps1 \
  -ProjectPath "D:\Projects\example"
```

默认删除：

```text
项目级 Skill Link/Copy
项目级运行时副本
项目 config.toml 受控区块
安装清单
.git/info/exclude 受控区块
```

默认保留：

```text
GlobalRuntime MCP
fork 工作区
原 Marketplace 克隆
用户非受控配置
```

可选参数：

```powershell
-RemoveSharedMcp
```

仅在明确传入时执行：

```powershell
codex mcp remove drawio-live
codex mcp remove drawio-file-utils
```

卸载前根据清单确认目标路径。若路径已被用户替换为普通目录，不直接删除，输出人工处理提示。

---

## 15. 上游同步脚本

文件：

```text
scripts/sync-upstream.ps1
```

接口：

```powershell
./scripts/sync-upstream.ps1
```

逻辑：

```text
确认 git 仓库
确认工作区干净
确认 origin/upstream URL
fetch upstream --prune
switch main
merge --ff-only upstream/main
push origin main
switch dev
rebase main
push --force-with-lease origin dev
```

可选参数：

```powershell
-NoPush
-SkipDevRebase
```

发生 rebase 冲突时输出：

```text
git status
git rebase --continue
git rebase --abort
```

不要自动解决核心目录冲突。

---

## 16. 文档任务

### 16.1 `adapters/codex-project-local/README.md`

包含：

- 适用场景；
- 三种 MCP Scope；
- Link 与 Copy 的差异；
- 安装、更新、卸载命令；
- 从全局插件迁移；
- Windows Junction 说明；
- 已知限制。

### 16.2 `docs/project-local-install.md`

提供完整教程：

```text
准备环境
克隆 fork/dev
安装到目标项目
验证 Skill
验证 MCP
执行 Draw.io 示例
故障处理
```

### 16.3 `docs/upstream-sync.md`

说明：

- `main` 不放私有提交；
- `dev` rebase 策略；
- 冲突处理；
- 为什么不直接修改核心目录。

### 16.4 `docs/migration-from-global-plugin.md`

说明：

- 如何判断全局插件是否安装；
- 为什么需要移除；
- 如何迁移；
- 如何回滚。

### 16.5 `README.dev.md`

作为 fork 的开发说明，不修改上游 `README.md`。

---

## 17. 测试任务

### 17.1 静态检查

继续运行原仓库测试：

```powershell
npm run check
npm test
```

为适配器增加：

```json
{
  "scripts": {
    "test:project-local": "node --test adapters/codex-project-local/tests/*.test.mjs",
    "test:all": "npm test && npm run test:project-local"
  }
}
```

### 17.2 单元测试

`project-root.mjs`：

- Git 根目录识别；
- 非 Git 项目；
- 嵌套目录；
- 路径含空格；
- 路径不存在；
- Windows 盘符。

`install-manifest.mjs`：

- 新建；
- 升级 Schema；
- 非法 JSON；
- 原子写入；
- 未知字段保留策略。

`patch-codex-config.mjs`：

- 空文件；
- 已有配置；
- 重复执行；
- 同名 MCP 冲突；
- 删除受控区块；
- CRLF/LF；
- 路径转义。

`git-exclude.mjs`：

- 添加；
- 更新；
- 删除；
- 不破坏其他规则。

### 17.3 集成测试矩阵

| 场景 | SkillMode | McpScope | 预期 |
|---|---|---|---|
| 新 Git 项目 | Link | GlobalRuntime | 安装成功 |
| 新 Git 项目 | Copy | Project | 安装成功 |
| 非 Git 项目 | Link | GlobalRuntime | 安装成功，无 exclude |
| 重复安装 | Link | GlobalRuntime | 幂等 |
| 已有相同 MCP | Link | GlobalRuntime | 复用 |
| 已有不同 MCP | Link | GlobalRuntime | 中止 |
| 已有未知 Skill 目录 | Link | None | 中止 |
| Link 源失效 | Link | None | update 报错并可修复 |
| Copy 更新 | Copy | Project | 原子替换 |
| 普通卸载 | Link | GlobalRuntime | 保留共享 MCP |
| 完全卸载 | Link | GlobalRuntime | 删除共享 MCP |

### 17.4 全局污染检查

测试前后比较：

```text
$HOME/.agents/skills
$HOME/.codex/skills
```

不得新增：

```text
recreate-scientific-figure-in-drawio
```

允许变化：

```text
$HOME/.codex/config.toml 中两个 MCP Server
```

仅在 `GlobalRuntime` 模式下允许。

### 17.5 端到端测试

使用实际 Codex 新会话：

```text
1. 从目标项目目录启动 Codex；
2. 确认 Skill 可见；
3. 调用 drawio_live_launch；
4. 检查 graph_ready=true；
5. 添加两个节点和一条边；
6. 截图；
7. 保存 .drawio；
8. validate；
9. 导出 PNG；
10. 在其他未安装项目启动 Codex，确认 Skill 不可见。
```

---

## 18. CI 建议

新增 GitHub Actions：

```text
.github/workflows/project-local-adapter.yml
```

触发：

```yaml
on:
  push:
    branches: [dev]
  pull_request:
    branches: [dev]
```

任务：

```text
Node 22 / Windows
Node 22 / Ubuntu
npm ci 或无依赖安装
npm run check
npm run test:project-local
PowerShell 安装器 dry-run
Shell 安装器 dry-run
```

由于 Draw.io Desktop 无法稳定在无 GUI CI 中进行实时测试，CI 只做：

- 脚本语法；
- 文件结构；
- 安装目录模拟；
- MCP 配置生成；
- 清单与卸载；
- 不做 CDP 端到端绘图。

真实 Draw.io 测试保留为本机发布前检查。

---

## 19. 实施阶段与提交拆分

### Phase 0：基线冻结

任务：

- 确认 `dev` 基于最新 `main`；
- 运行原始 `npm test`；
- 保存测试结果；
- 记录上游 Commit；
- 建立 `README.dev.md`。

提交：

```text
chore(dev): document fork and upstream synchronization policy
```

完成条件：

- 原始测试通过；
- `git diff upstream/main -- plugins/drawio-scientific-illustrator` 为空。

### Phase 1：项目级 Skill 安装器

任务：

- PowerShell 安装器骨架；
- 项目根目录解析；
- Link 模式；
- Copy 模式；
- Git exclude；
- 安装清单。

提交：

```text
feat(project-local): add project-scoped skill installer
feat(project-local): support link and copy skill modes
```

完成条件：

- Skill 可安装到 `.agents/skills`；
- 不触碰全局 Skills；
- 重复安装幂等。

### Phase 2：MCP Scope 适配

任务：

- GlobalRuntime 注册；
- Project config 写入；
- None 模式；
- 同名冲突保护；
- MCP 路径校验。

提交：

```text
feat(mcp): add project and shared runtime registration modes
```

完成条件：

- 两个 MCP Server 名称和脚本不变；
- 不安装原全局插件也能使用 MCP。

### Phase 3：迁移、更新与卸载

任务：

- 全局插件检测；
- 显式迁移；
- update；
- uninstall；
- 共享 MCP 保留策略。

提交：

```text
feat(migration): migrate from globally installed Codex plugin
feat(project-local): add safe update and uninstall workflows
```

完成条件：

- 可从原插件迁移；
- 卸载不破坏其他项目。

### Phase 4：测试与文档

任务：

- Node 单元测试；
- PowerShell dry-run；
- 文档；
- CI；
- Windows 实机端到端测试。

提交：

```text
test(project-local): cover installer config and manifest behavior
docs(project-local): document install migration and upstream sync
ci(project-local): validate project-scoped adapter
```

完成条件：

- `npm run test:all` 通过；
- Windows 实机流程通过；
- 文档命令可复制执行。

### Phase 5：发布候选

任务：

- 从干净环境重新安装；
- 使用一个真实科研项目测试；
- 使用另一个未安装项目验证隔离；
- 从上游同步一次并验证 rebase；
- 创建 `dev-project-local-v0.1.0` 标签或 GitHub Release 草稿。

完成条件：

- 全部验收项通过；
- 核心目录相对上游无改动；
- 可清晰回滚。

---

## 20. 推荐的 GitHub Issues

在 fork 中建立以下 Issues，并加入 `project-local` Milestone：

```text
[Project Local] Add PowerShell installer skeleton
[Project Local] Implement project root discovery
[Project Local] Implement Link-mode skill installation
[Project Local] Implement Copy-mode runtime installation
[Project Local] Add installation manifest
[Project Local] Add GlobalRuntime MCP registration
[Project Local] Add project .codex/config.toml support
[Project Local] Add global plugin migration
[Project Local] Add update and uninstall workflows
[Project Local] Add test suite and CI
[Project Local] Document installation and upstream sync
[Project Local] Run Windows end-to-end validation
```

每个 Issue 保持单一职责，避免一个 PR 同时修改安装、迁移、测试和文档。

---

## 21. 安全与回滚

### 21.1 写文件规则

- 所有配置写入前备份；
- 使用临时文件和原子重命名；
- 只删除清单记录的路径；
- 未知目录和未知配置不覆盖；
- `Force` 不等于无条件删除；
- 同名 MCP 命令不同则中止。

### 21.2 回滚项目安装

```powershell
./adapters/codex-project-local/uninstall.ps1 \
  -ProjectPath "D:\Projects\example"
```

### 21.3 回滚到原全局插件

```powershell
codex plugin marketplace add "<fork-or-upstream-root>"
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

然后从项目中卸载本地 Skill。

### 21.4 中止上游 rebase

```powershell
git rebase --abort
```

由于核心文件未改动，正常情况下冲突只会发生在：

```text
package.json
README.dev.md
docs/
adapters/
scripts/sync-upstream.*
```

---

## 22. 验收清单

### 仓库结构

- [ ] `origin/main` 与 `upstream/main` 一致；
- [ ] 所有自定义改动位于 `dev`；
- [ ] 核心插件目录未产生功能性改动；
- [ ] 原全局安装器仍可使用；
- [ ] 新适配器位于独立目录。

### Skill 隔离

- [ ] Skill 安装到 `<ProjectRoot>/.agents/skills`；
- [ ] `$HOME/.agents/skills` 未新增该 Skill；
- [ ] `$HOME/.codex/skills` 未新增该 Skill；
- [ ] 目标项目可以发现 Skill；
- [ ] 未安装项目不能发现 Skill。

### MCP

- [ ] `drawio-live` 名称不变；
- [ ] `drawio-file-utils` 名称不变；
- [ ] 两个脚本路径正确；
- [ ] GlobalRuntime 模式可用；
- [ ] Project 模式可以生成正确配置；
- [ ] 同名冲突不会被静默覆盖。

### 安装生命周期

- [ ] install 幂等；
- [ ] update 幂等；
- [ ] uninstall 幂等；
- [ ] Link 模式源更新自动生效；
- [ ] Copy 模式可安全更新；
- [ ] 卸载一个项目不会删除共享 MCP；
- [ ] 迁移不会造成 Skill 与 MCP 同时不可用。

### Draw.io 功能

- [ ] 可启动 Draw.io Desktop；
- [ ] `graph_ready=true`；
- [ ] 可实时添加 Shape；
- [ ] 可实时添加 Edge；
- [ ] 可截图；
- [ ] 可更新 Cell；
- [ ] 可保存 `.drawio`；
- [ ] 可校验；
- [ ] 可导出 PNG/SVG/PDF；
- [ ] 所有图元仍保持可编辑。

### 上游同步

- [ ] `main` 可 fast-forward 同步；
- [ ] `dev` 可 rebase；
- [ ] 同步脚本在工作区不干净时中止；
- [ ] 同步脚本不使用危险 reset；
- [ ] 同步后 Link 模式项目继续可用。

---

## 23. 建议执行顺序

直接按下面顺序开始：

```text
1. Phase 0：冻结基线并补 README.dev.md
2. 创建 feat/project-local-installer
3. 完成 PowerShell Link 模式
4. 完成安装清单与 Git exclude
5. 补 Copy 模式
6. 完成 GlobalRuntime MCP
7. 完成 Project MCP
8. 完成迁移
9. 完成 update/uninstall
10. 补单元测试与 CI
11. 做 Windows 端到端测试
12. 合并到 dev
13. 执行一次上游同步演练
14. 发布 dev-project-local-v0.1.0
```

本轮最小可用版本可以在以下条件满足时先落地：

```text
PowerShell install.ps1
SkillMode=Link
McpScope=GlobalRuntime
安装清单
基础验证
迁移说明
```

这组能力已经能解决当前核心需求。Copy、Project MCP、Shell、CI 可以在后续 PR 中补齐，不必阻塞初版使用。

---

## 24. 初版完成定义

`dev-project-local-v0.1.0` 满足：

```text
- Windows 可把原始 Skill 以 Junction 安装到任意项目；
- 不写入全局 Skills；
- 不安装原 Codex Plugin；
- 两个原始 MCP Server 可通过 Codex 全局运行时使用；
- 可以从原全局插件迁移；
- 可以安全卸载项目级 Skill；
- 原始实时 Draw.io 绘图设计完全保留；
- dev 可基于最新 main 继续 rebase；
- 原仓库测试与新增适配器测试通过。
```

