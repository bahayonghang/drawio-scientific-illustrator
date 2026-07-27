# 快速开始与安装指南

## 环境要求

在安装插件之前，请确认您的系统满足以下条件：

1. **Codex 桌面端或 Codex CLI**（支持 Plugin 功能）；
2. **[draw.io 桌面版](https://www.drawio.com/)**（已安装在本地系统）；
3. **Git** 环境；
4. **Node.js 22 或更高版本**（在系统 `PATH` 中可直接执行 `node`）。

## 安装方式

### 方式 1：Codex 任务一键安装（推荐）

在具备终端执行权限的 Codex 对话框中直接粘贴以下指令：

```text
请安装这个公开 Codex 插件：https://github.com/icebird1998/drawio-scientific-illustrator。
把仓库克隆到本地，将仓库根目录注册为 Codex Marketplace，然后安装
drawio-scientific-illustrator@drawio-scientific-tools。完成后告诉我何时重启 Codex。
```

### 方式 2：使用 `just` 命令（自动识别操作系统与目标平台）

如果您的系统中已安装 `just`：

```bash
just install          # 默认安装至 Codex
just install codex    # 安装至 Codex
just install claude   # 安装项目级本地 Skill & MCP 至 Claude Code
just install both     # 同时安装至 Codex 和 Claude Code
```

脚本会自动判断操作系统环境（Windows 下使用 `install.ps1`，macOS/Linux 下使用 `install.sh`），并传入目标平台参数。

### 方式 3：单行安装脚本

**Windows (PowerShell)**：
```powershell
$p="$env:TEMP\drawio-scientific-install.ps1"; Invoke-WebRequest https://raw.githubusercontent.com/icebird1998/drawio-scientific-illustrator/main/install.ps1 -OutFile $p; powershell -ExecutionPolicy Bypass -File $p
```

**macOS / Linux (Bash)**：
```bash
curl -fsSL https://raw.githubusercontent.com/icebird1998/drawio-scientific-illustrator/main/install.sh | bash
```

> **提示**：安装完成后，**必须重启 Codex** 并新建一个任务（New Task），以使新的 Skill 和 MCP 工具载入生效。

## 本地开发与在线文档

使用以下命令启动本地 VitePress 在线文档服务：

```bash
just docs
```

### 方式 3：手动命令安装

**PowerShell (Windows)**：
```powershell
git clone https://github.com/icebird1998/drawio-scientific-illustrator.git
Set-Location drawio-scientific-illustrator
codex plugin marketplace add (Get-Location).Path
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

**Bash (macOS / Linux)**：
```bash
git clone https://github.com/icebird1998/drawio-scientific-illustrator.git
cd drawio-scientific-illustrator
codex plugin marketplace add "$(pwd)"
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```
