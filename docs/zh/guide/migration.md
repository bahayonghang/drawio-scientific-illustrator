# 从全局插件迁移指南

原版 upstream 项目将 Draw.io Scientific Illustrator 安装为 **Codex 全局插件**（在所有 Codex 会话中均可用）。本项目 Fork 增加了**项目级本地安装 (Project-Local Install)** 选项。本页面介绍了如何从全局插件迁移到项目本地安装。

## 我需要迁移吗？

仅当您希望为 Codex 使用项目级隔离安装时才需要迁移。全局插件仍然可以像以前一样正常工作。

由于项目级和全局安装均注册了相同的两个 MCP 服务名称：`drawio-live` 与 `drawio-file-utils`，同时运行两者会导致服务命名冲突。

如果您不打算迁移，可以在安装时传入 `--mcp none` 参数：仅保留项目内 Skill 文件，继续复用全局插件的 MCP 服务。

## 自动迁移命令

在目标项目路径下运行：

```bash
node adapters/project-local/install.mjs \
  --project /path/to/your-project \
  --platform codex \
  --migrate-from-global-plugin
```

执行流程：

1. 安装项目级本地 Skill 和 MCP 配置文件；
2. **校验服务**：自动启动安装的 MCP 服务并确认工具列表；
3. 校验成功后才卸载全局插件 (`codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools`)。

若校验失败，全局插件将被安全保留，绝不会出现两者均无法使用的情况。

## 手动迁移步骤

手动拆解的迁移命令：

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform codex
codex mcp list                       # 确认项目本地 MCP 服务正常加载
codex plugin remove drawio-scientific-illustrator@drawio-scientific-tools
```

## 回退方案

如需回退至全局插件模式：

```bash
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
node adapters/project-local/uninstall.mjs --project /path/to/your-project --remove-platform codex
```
