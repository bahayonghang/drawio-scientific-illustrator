# Tests and CI for project-local adapter

父任务:`07-26-project-local-skill`。前置:07-26-installer-core、07-26-mcp-config-writers、
07-26-lifecycle-migration。任务性质:复杂 —— 激活前需补 design.md + implement.md。

## Goal

用 Node 内置 `node --test` 收口适配器测试(单元 + 集成矩阵 + 全局污染检查),接入
npm scripts,并新增 GitHub Actions 工作流(Node 22 × Windows/Ubuntu)。不引入任何
测试框架依赖。

## Requirements

### 单元测试(adapters/project-local/tests/)
- `project-root`:Git 根识别、非 Git、嵌套目录、含空格路径、不存在路径、盘符归一。
- `install-manifest`:新建、v1→v2 升级、非法 JSON、原子写、未知字段保留。
- `patch-mcp-json`:空文件/无文件、既有 servers 保留、同名等价复用、同名冲突中止、
  重复执行幂等。
- `patch-codex-config`:空文件、已有用户 TOML 保留、区块外同名表头中止、区块删除、
  CRLF/LF、Windows 路径转义。
- `git-exclude`:添加/更新/删除区块,不破坏其他规则。
- `skill-package`:装配完整性(文件清单)、源缺失中止、原子替换失败恢复。
- 所有夹具在 `os.tmpdir()` 下生成,不含 `C:\Users` 等本地路径字面量(validate-repo 红线)。

### 集成矩阵(临时目录模拟目标项目,沿用草稿文档 §17.3 调整后)
| 场景 | platform | mcp | 预期 |
|---|---|---|---|
| 新 Git 项目 | claude | project | 成功 |
| 新 Git 项目 | codex | project | 成功 |
| 新 Git 项目 | both | project | 成功,双拷贝 |
| 非 Git 项目 | claude | project | 成功,无 exclude |
| 重复安装 | both | project | 幂等 |
| 已有等价 MCP | claude | project | 复用 |
| 已有冲突 MCP | claude | project | 退出 2 |
| 已有未知 Skill 目录 | claude | none | 退出 2 |
| update 后 | both | project | 原子替换,commit 刷新 |
| uninstall | both | project | 无残留 |

### 全局污染检查
- 测试套件前后快照 `$HOME/.claude/skills`、`$HOME/.agents/skills`、`$HOME/.codex/skills`,
  断言未新增 `recreate-scientific-figure-in-drawio`。实现上所有测试必须重定向 HOME 相关
  写入到临时目录,此检查作为兜底断言。
- `~/.codex/config.toml` **不要比对 mtime** —— Codex 自身在日常操作中就会重写该文件
  (实测:全程 `CODEX_HOME` 重定向的情况下真实配置仍被 Codex 改动),mtime 断言必然假阳性。
  改用两条精确断言(子任务 3 已手工验证,见其 `research/verification.md`):
  1. 真实配置不含 `drawio-scientific-illustrator managed block`;
  2. ~~`~/.codex/config.toml.bak` 时间戳未被刷新~~ —— **实现时改进,见 design.md §3**:
     子任务 4 已把备份后缀改成 `.drawio-install.bak`(原 `.bak` 与 Codex 自己的备份重名),
     该后缀 Codex 永远不会产生,故直接断言 `~/.codex/config.toml.drawio-install.bak`
     **不存在** 即可 —— 无需基线、无需 mtime 比对,且不会被第三方写入干扰。
- 前后快照亦改为绝对后置条件(design.md §3):`node --test` 每个文件独立进程,
  单个测试文件无法观测整套的前后状态;改由 `tests/check-global-pollution.mjs`
  在 `node --test` 之后独立运行。
- 所有 Codex 用户级测试必须设置 `CODEX_HOME` 指向临时目录。

### npm scripts 与 CI
- `package.json`:`test:project-local`(`node --test adapters/project-local/tests/`)、
  `test:all`(原 test + project-local);原 `npm test` 语义不变。
- `.github/workflows/project-local-adapter.yml`:push/PR 到 dev 触发;矩阵
  Node 22 × (windows-latest, ubuntu-latest);步骤 = `npm run check` +
  `npm run test:project-local` + `install.mjs --dry-run` 演练;不做 CDP/draw.io 端到端。
- 确认 `scripts/validate-repo.mjs` 对新增 workflow 与 scripts 字段无冲突。

## Acceptance Criteria

- [x] `npm run test:all` 本地(Windows)全绿:71 tests / 71 pass。新增 `paths.test.mjs`
      补齐盘符归一与源缺失中止,`patch-codex-config` 补齐 TOML 反斜杠转义断言。
- [x] 集成矩阵 10 场景全部有对应测试并通过:1–8 在 `integration.test.mjs`,
      9–10 在 `lifecycle.test.mjs`(映射表见 design.md §5;row 9 的 "commit 刷新"
      本次新增断言)。
- [x] 全局污染断言存在且通过 —— 且做过反向验证:构造带 managed block、
      `.drawio-install.bak` 与 skill 目录的假 HOME,三条断言全部触发、退出 1。
- [ ] CI 在 dev 分支 push 后 windows+ubuntu 双绿(证据:run 链接存 research/)。
      **待 push;push 属对外动作,已单独向用户确认。**
- [x] 附带决议:`validate-repo.mjs` 扫描范围扩展到 `adapters/project-local/**/*.mjs`
      (design.md §7)。扩展后立刻抓到本次新写测试里的 `C:/Users/...` 字面量,已改为中性路径。
