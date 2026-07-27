# 项目级本地安装指南

原版插件仅支持 Codex 全局安装。本 Fork 提供了第二种选择：将 Skill 与两个 MCP 服务**置于单个项目目录内部**，同时支持 **Claude Code** 与 **Codex**。

## 前置要求

- **Node.js 22 或更高版本**（通过 `node --version` 确认）；
- 本地已安装 **draw.io 桌面版**；
- 克隆了本 Fork 仓库以运行适配器安装脚本。

## 安装命令

在本仓库根目录运行安装脚本：

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform both
```

参数 `--platform` 可设置为 `claude`、`codex` 或 `both`。

### 预演模式 (Dry-Run)

在不修改任何实际文件的前提下预览安装动作：

```bash
node adapters/project-local/install.mjs --project /path/to/your-project --platform both --dry-run
```

## 写入目标项目的目录结构

```
your-project/
├── .claude/skills/recreate-scientific-figure-in-drawio/   # Claude Code Skill
│   ├── SKILL.md
│   ├── agents/openai.yaml
│   └── scripts/{live-server,server,drawio-path}.mjs
├── .agents/skills/recreate-scientific-figure-in-drawio/   # Codex Skill
├── .mcp.json                                              # Claude Code MCP 配置
├── .codex/config.toml                                     # Codex MCP 配置
└── .agents/drawio-scientific-install.json                 # 安装清单描述文件
```

## 验证安装

### Claude Code

在目标项目根目录下启动 session：

```bash
cd /path/to/your-project
claude
```

输入 `/mcp` 确认 `drawio-live` 和 `drawio-file-utils` 已正常加载。

### Codex

在目标项目目录中执行：

```bash
codex mcp list
```

确认两个服务均显示为启用状态。

## 卸载项目级安装

如需清理项目内部生成的配置文件：

```bash
node adapters/project-local/uninstall.mjs --project /path/to/your-project --remove-platform both
```
