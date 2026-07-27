# Implement — Update, uninstall, migration

## Checklist

### 组 0 — 备份后缀修正(先做,阻塞其余)

- [ ] `lib/backup.mjs`:`BACKUP_SUFFIX = ".drawio-install.bak"` + `backupPathFor(file)`。
- [ ] `patch-mcp-json.mjs` / `patch-codex-config.mjs` 改用 `backupPathFor()`。
- [ ] `install.mjs` 的 `excludeEntries()`:`.mcp.json.bak` → `.mcp.json.drawio-install.bak`,
      新增 `.codex/config.toml.drawio-install.bak`。
- [ ] 现有单测里断言 `${file}.bak` 的地方同步改名。
- [ ] 验证:装一次,确认生成的是新后缀;`~/.codex/config.toml.bak` 不被创建/改写。

### 组 1 — 共用加载器

- [ ] `lib/installed.mjs`:`loadInstalled(projectInput, { required })`(design §2)。

### 组 2 — update.mjs

- [ ] A-H 流程(design §3),含 D 步的用户改动检测与 `--force` 放行。
- [ ] `--pull-source`(design §3.1):脏工作区 / 非 dev 分支 / 非 ff 三种中止路径。
- [ ] MCP 重写沿用清单里的 `mcpScope` 与 `mcpPathStyle`,不重新探测。

### 组 3 — uninstall.mjs

- [ ] A-G 流程(design §4),含"未知文件则跳过不删"与幂等(无清单 exit 0)。
- [ ] `--remove-platform claude|codex|all`;只删一个平台时清单保留另一平台并刷新 exclude。
- [ ] 空目录清理只碰 `.agents/`、`.claude/skills/`、`.agents/skills/`,且仅在为空时。

### 组 4 — 迁移

- [ ] `lib/migrate.mjs`(design §5)。
- [ ] `install.mjs` 接入 `--migrate-from-global-plugin`:参数校验前置、
      与 `--skip-verification` 互斥、验证通过后才移除插件、`--dry-run` 只打印。

### 组 5 — 单测

- [ ] `tests/update.test.mjs`:源 commit 变化后重装配、用户改动中止、`--force` 放行、
      替换失败恢复旧目录。
- [ ] `tests/uninstall.test.mjs`:全平台卸载无残留、单平台卸载保留另一平台、
      未知文件跳过、重复卸载幂等、用户级 Codex 区块绑定给别的项目时不删。
- [ ] `tests/migrate.test.mjs`:平台不含 codex → exit 1;与 `--skip-verification` 互斥;
      codex CLI 缺失 → exit 1(用 `PATH` 置空的子进程模拟,不依赖真机是否装了 codex)。
- [ ] 全部 Codex 用户级测试设置 `CODEX_HOME` 指向临时目录。

## 验证命令

```bash
node --check adapters/project-local/update.mjs
node --check adapters/project-local/uninstall.mjs
node --test "adapters/project-local/tests/*.test.mjs"
npm test
```

端到端(`CODEX_HOME` 重定向):

```bash
node adapters/project-local/install.mjs   --project <tmp> --platform both
node adapters/project-local/update.mjs    --project <tmp>
node adapters/project-local/uninstall.mjs --project <tmp>
git -C <tmp> status --porcelain      # 期望与安装前一致
```

## 审查门禁

- install → update → uninstall 全链路后,目标项目与安装前 `git status` 一致、无残留。
- 用户在 skill 目录里加的文件,update 与 uninstall 都不得删除。
- `~/.codex/config.toml` 不含受控区块;`~/.codex/config.toml.bak` 时间戳未被刷新
  (子任务 3 确立的精确断言)。
- `npm test` 绿;新增文件无本地绝对路径。

## 回滚点

单独成串提交。update 的破坏面由 `assembleSkill` 的 `.backup-<pid>` 兜底;
uninstall 只删清单记录过且结构未被改动的路径。
