# Implement — Installer core

按 design.md 的模块顺序自底向上实现,每组做完立即验证。全部文件在 `adapters/project-local/`。

## Checklist

### 组 1 — 基础设施

- [ ] `lib/cli.mjs`:`ExitError`、`parseArgs(argv, spec)`、`log`。
      未知参数 → `ExitError(1)`;`--help` 打印用法并 `exit(0)`。
- [ ] `lib/paths.mjs`:`adapterDir` / `repoRoot` / `sourceRoot` / `SOURCE_FILES` /
      `assertSourcesPresent()` / `normalize()` / `toPosix()`。
- [ ] 验证:`node adapters/project-local/install.mjs --help` 有输出;
      `node --check` 两个文件通过。

### 组 2 — 目标解析

- [ ] `lib/project-root.mjs`:`resolveProjectRoot(input)`(design §4,`.git` 目录或文件)。
- [ ] `lib/platform.mjs`:`resolvePlatforms(input, root)` + `skillDirFor(platform)`(design §10.1)。
- [ ] 验证:临时目录手工试 Git/非 Git/嵌套子目录/不存在四种输入。

### 组 3 — 装配

- [ ] `lib/skill-package.mjs`:`assembleSkill()`(design §5.2)、`describeInstalled()`(§5.3)。
- [ ] 验证:装配到临时目录,`ls -R` 与 design §5.1 表一致;三个脚本 `node --check` 通过。

### 组 4 — 状态落盘

- [ ] `lib/install-manifest.mjs`:`readManifest` / `writeManifest` / `manifestPath`(design §7)。
- [ ] `lib/git-exclude.mjs`:`applyExcludeBlock` / `removeExcludeBlock`(design §8)。
- [ ] 验证:预置一个带自定义规则的 `.git/info/exclude`,写入后自定义规则原样保留;
      重复写入不产生第二个区块。

### 组 5 — 接缝与验证

- [ ] `lib/mcp.mjs`:`writeMcpConfig({ platform, root, manifest, dryRun })` —— 本任务内
      `--mcp none` 直接 return;`--mcp project` 打印
      `MCP config writing lands in a later change; re-run with --mcp none for now.`
      并 `ExitError(1)`。**留好签名,子任务 3 只填实现,不改调用点。**
- [ ] `lib/verify-install.mjs`:`verifyInstall()`(design §9,含 live-server 的
      `initialize` + `tools/list` 探活,8 s 超时)。

### 组 6 — 编排

- [ ] `install.mjs`:A-M 阶段(design §10),冲突检查表(design §6),`--dry-run` 分流。
- [ ] 收尾摘要必须包含:安装到哪些平台、清单路径、
      **"Launch `claude` from the project root — `.mcp.json` resolves server paths
      against the launch directory"** 这条约束(父 design §4.1)。

### 组 7 — 单测骨架(不求完备,子任务 6 收口)

- [ ] `tests/project-root.test.mjs`、`tests/install-manifest.test.mjs`、
      `tests/git-exclude.test.mjs`、`tests/skill-package.test.mjs`。
- [ ] 夹具一律在 `os.tmpdir()` 下生成,**不得出现 `C:\Users` 字面量**。
- [ ] `package.json` 暂不加 script(子任务 6 统一加);本任务用
      `node --test "adapters/project-local/tests/*.test.mjs"` 直接跑。
      **注意:必须用带引号的 glob,不能用目录参数** —— `node --test <dir>` 在 Node 25
      上会把目录当成测试文件并 `MODULE_NOT_FOUND` 失败(本机 v25.9.0 实测)。glob 形式
      在 Node 22 与 25 上都可用,由 Node 自己展开,不依赖 shell,Windows/PowerShell 也安全。
      子任务 6 加 `test:project-local` script 时沿用这个形式。

## 验证命令

```bash
node --check adapters/project-local/install.mjs
node --test "adapters/project-local/tests/*.test.mjs"
npm test
```

端到端手工验证(design §6 冲突表 + 父 PRD 验收):

```bash
node adapters/project-local/install.mjs --project <tmp> --platform claude --mcp none --dry-run
node adapters/project-local/install.mjs --project <tmp> --platform claude --mcp none
node adapters/project-local/install.mjs --project <tmp> --platform both   --mcp none
```

自包含性抽查(父 PRD 验收要求,结论写 `research/`):把装好的
`<tmp>/.claude/skills/.../scripts/server.mjs` 单独启动,喂 `initialize` + `tools/list`,
确认 9 个工具返回。

## 审查门禁

- `npm test` 绿。
- 重复安装幂等:第二次执行输出无变化、退出 0、清单 `installedAt` 不变而 `updatedAt` 变。
- 预置一个非本工具的同名 skill 目录 → 退出 2 且该目录内容未被改动(`--force` 同样退出 2)。
- 非 Git 项目:安装成功、无 exclude 写入、有明确 warn。
- 新增文件无本地绝对路径字面量。

## 回滚点

单独成串提交,可整体 revert。安装器对目标项目的破坏面由 `.backup-*` 与清单兜底
(design §5.2)。
