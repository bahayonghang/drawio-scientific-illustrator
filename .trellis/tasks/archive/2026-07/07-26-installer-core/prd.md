# Installer core with self-contained skill copy

父任务:`07-26-project-local-skill`。前置:07-26-baseline-fork-docs。
任务性质:复杂 —— 激活前需补本任务 design.md + implement.md。

## Goal

实现 `adapters/project-local/install.mjs` 及其 lib 模块:把核心区的 SKILL.md + agents/ +
三个 MCP 脚本装配成自包含 Skill 目录,复制到目标项目的平台目录,写安装清单与 git
exclude。本任务不含 MCP 配置写入(子任务 mcp-config-writers)——`--mcp none` 路径先行,
`--mcp project` 在集成子任务 3 后生效。

## Requirements

- CLI 契约与安装流程遵守父 design.md §3(参数、默认值、退出码、A-F 阶段)。
- `lib/project-root.mjs`:显式路径 → 向上找 `.git`(目录或文件)→ 回退到路径本身;
  绝对化、`~` 展开、Windows 盘符大小写归一;路径不存在/是文件/不可写时中止
  (草稿文档 §6 语义)。
- `lib/skill-package.mjs`:装配到临时目录后原子 rename;复制清单 = `SKILL.md` +
  `agents/**` + `scripts/{live-server,server,drawio-path}.mjs`;源文件缺失即中止;
  装配后对三个脚本跑 `node --check`。
- `--platform auto` 探测规则(父 design.md §3);`both` 时按平台各装一份(父 design.md §2)。
- `lib/install-manifest.mjs`:schema v2(父 design.md §5),`.tmp` + rename 原子写,
  已有清单时做升级/合并,非法 JSON 报错不覆盖。
- `lib/git-exclude.mjs`:受控区块增删改(父 design.md §6),不破坏区块外规则;
  非 Git 项目跳过并提示。
- 幂等:同参数重复安装结果一致且退出 0;目标已有**非本工具**同名 Skill 目录时退出 2,
  `--force` 亦不得删除非清单管理的内容(草稿文档 §21.1)。
- `--dry-run`:完整走检查与计划,打印动作列表,不写盘。
- 全部代码零依赖、`node:` 导入、可在 Node 22 运行;不含任何本地绝对路径字面量。

## Acceptance Criteria

- [ ] 临时目录建的 Git 项目上:`install --platform claude --mcp none` 后,Skill 目录、
      清单、exclude 区块齐备,`node --check` 通过。
- [ ] `--platform both` 生成两份拷贝,清单 `platforms` 记录两个条目。
- [ ] 重复安装幂等;预置同名普通目录时中止且目录未被改动。
- [ ] 非 Git 项目可安装,无 exclude 写入,有明确提示。
- [ ] 装配后删除 fork 仓库副本,项目内 `node .claude/skills/.../scripts/server.mjs`
      可启动并响应 `tools/list`(手动验证一次,记录到 research/)。
- [ ] `npm test`(原有)保持通过。

## Notes

- 与子任务 3 的接口:install.mjs 预留 `writeMcpConfig(platform, manifest)` 调用点,
  本任务内为 no-op(`--mcp none`)。
- 测试留待子任务 6 收口,但本任务应随手写核心 lib 的 `*.test.mjs` 骨架。
