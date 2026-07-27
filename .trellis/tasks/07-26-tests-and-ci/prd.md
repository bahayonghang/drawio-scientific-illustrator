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

### npm scripts 与 CI
- `package.json`:`test:project-local`(`node --test adapters/project-local/tests/`)、
  `test:all`(原 test + project-local);原 `npm test` 语义不变。
- `.github/workflows/project-local-adapter.yml`:push/PR 到 dev 触发;矩阵
  Node 22 × (windows-latest, ubuntu-latest);步骤 = `npm run check` +
  `npm run test:project-local` + `install.mjs --dry-run` 演练;不做 CDP/draw.io 端到端。
- 确认 `scripts/validate-repo.mjs` 对新增 workflow 与 scripts 字段无冲突。

## Acceptance Criteria

- [ ] `npm run test:all` 本地(Windows)全绿;单测覆盖上表全部模块与场景。
- [ ] 集成矩阵 10 场景全部有对应测试并通过。
- [ ] 全局污染断言存在且通过。
- [ ] CI 在 dev 分支 push 后 windows+ubuntu 双绿(证据:run 链接存 research/)。
