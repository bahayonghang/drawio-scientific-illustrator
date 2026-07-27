# Draw.io Scientific Illustrator (中文说明)

[English README](README.md) · [中文说明](README_zh.md) · [在线文档(VitePress)](docs/index.md) · [MIT 许可证](LICENSE)

**Draw.io Scientific Illustrator** 是一个专为科研插图打造的 Codex 插件。它能让 AI Agent 在**可见的桌面版 draw.io 画布**上实时绘制复杂的科学图表。你可以亲眼看到形状、文字、箭头、配色和布局按步骤出现在画布中。

与生成静态文件不同，本插件的实时工作流通过仅限本机的 MCP 服务直接调用 draw.io 自身的图模型 (Graph API)。它**不依赖操作系统级的鼠标或键盘自动化**，也**不会先生成 XML 临时文件再打开**。

> **当前状态**：Windows 环境已充分测试。macOS 与 Linux 已内置可执行文件自动查找，但因 Electron 打包差异，实时行为可能有所不同，欢迎提交 Issue 和 PR。

---

## 核心特性

- **`drawio-live` MCP 服务**：启动或连接至可见的 draw.io 桌面编辑器，实时修改当前图模型。
- **`drawio-file-utils` MCP 服务**：校验已保存的 `.drawio` 图表文件结构，并将其导出为 PNG、SVG、PDF 或 JPG 交付物。
- **Codex Skill**：指导 Agent 解析参考图、分解图元、按设定节奏步进绘制、分区块视觉检查、精细修正图表，并在可见画布绘制完成后保存文件。
- **插件市场与开箱即用**：提供自带的 Codex Marketplace 配置，可作为独立插件一键安装。

---

## 安装要求

1. 支持插件功能的 Codex 桌面端或 Codex CLI；
2. 本机已安装 [draw.io 桌面版](https://www.drawio.com/)；
3. Git 环境；
4. 如果在 Codex 以外的独立环境中启动 MCP，需要 Node.js（推荐 Node.js 22 或更高版本）。

> 插件会自动检测 Windows、macOS 和 Linux 常见的 draw.io 安装路径。若安装在自定义目录，请在启动 Codex 前配置环境变量 `DRAWIO_PATH`。

---

## 安装指南

### 1. Codex 任务一键安装（推荐）

在一个具备终端执行权限的 Codex 任务中粘贴以下内容：

```text
请安装这个公开 Codex 插件：https://github.com/icebird1998/drawio-scientific-illustrator。
把仓库克隆到本地，将仓库根目录注册为 Codex Marketplace，然后安装
drawio-scientific-illustrator@drawio-scientific-tools。完成后告诉我何时重启 Codex。
```

### 2. 使用 `just` 命令安装（自动识别操作系统与目标平台）

如果您的系统中已安装 `just`：

```bash
just install          # 默认安装至 Codex
just install codex    # 安装至 Codex
just install claude   # 安装项目级本地 Skill & MCP 至 Claude Code
just install both     # 同时安装至 Codex 和 Claude Code
```

### 3. 单行脚本安装

**Windows (PowerShell)**：
```powershell
$p="$env:TEMP\drawio-scientific-install.ps1"; Invoke-WebRequest https://raw.githubusercontent.com/icebird1998/drawio-scientific-illustrator/main/install.ps1 -OutFile $p; powershell -ExecutionPolicy Bypass -File $p
```

**macOS / Linux (Bash)**：
```bash
curl -fsSL https://raw.githubusercontent.com/icebird1998/drawio-scientific-illustrator/main/install.sh | bash
```

> **注意**：安装完成后，必须重启 Codex 并新建任务，以使新的 Skill 和 MCP 工具载入生效。

### 4. 启动本地 VitePress 文档服务

```bash
just docs
```

### 3. 手动安装

**PowerShell**：
```powershell
git clone https://github.com/icebird1998/drawio-scientific-illustrator.git
Set-Location drawio-scientific-illustrator
codex plugin marketplace add (Get-Location).Path
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

**Bash (macOS/Linux)**：
```bash
git clone https://github.com/icebird1998/drawio-scientific-illustrator.git
cd drawio-scientific-illustrator
codex plugin marketplace add "$(pwd)"
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

---

## 使用教程

1. 重启 Codex 并新建一个对话任务；
2. 上传科研论文插图参考文件（PNG、JPEG、SVG 或 PDF 页面截图）；
3. 在对话框中选择或提及 **Draw.io Scientific Illustrator**；
4. 描述重绘要求、绘制步进间隔及导出格式。

> **复杂科研插图的推荐模型配置**：建议选择 **GPT-5.6 Sol**，并将推理等级设置为 **Max (最高)**。需先在 Codex 设置中开启 **6 档推理等级选择器**（默认 5 档选择器不会显示 Max 选项）。

### 推荐提示词示例

```text
使用 Draw.io Scientific Illustrator。启动实时 draw.io，以 100 ms 的步骤间隔逐步重绘
这张参考图。必须直接控制 draw.io 自己的画布 API，不要控制系统鼠标键盘，也不要先
生成 XML。所有文字、箭头、分区、图例都要保持可编辑。每完成一个逻辑区域就检查并
修正，最后保存 .drawio，并导出宽度为 2000 px 的 PNG 预览图。
```

---

## 工作流程说明

Agent 在绘图过程中通常遵循以下执行顺序：

1. `drawio_live_launch` —— 启动或连接可见的 draw.io 编辑器；
2. `drawio_live_status` —— 检查并确认内部 Graph 引擎就绪；
3. `drawio_live_add_shape` / `drawio_live_add_edge` / `drawio_live_draw_sequence` —— 逐步在画布中构建可编辑的图形与连线；
4. `drawio_live_screenshot` —— 截取当前 draw.io 编辑器渲染状态，进行视觉比对与质量检查；
5. `drawio_live_inspect` / `drawio_live_update_cell` —— 微调文本、样式、几何坐标与尺寸；
6. `drawio_live_fit` —— 调整画布视角与缩放比例，使绘图始终在视口中央；
7. `drawio_live_save_snapshot` —— 将可见画布中的模型序列化保存为 `.drawio` 文件；
8. `drawio_validate` 与 `drawio_export` —— 校验导出的文件完整性，生成 PNG/SVG/PDF/JPG 目标文件。

---

## 环境变量配置

| 环境变量 | 说明 | 默认值 |
|---|---|---|
| `DRAWIO_PATH` | 显式指定 draw.io 可执行文件的绝对路径 | 自动检测标准安装路径 |
| `DRAWIO_LIVE_PORT` | 首选的 Chrome Remote Debugging 端口 | `9333`（若占用将自动递增选择空闲端口） |
| `DRAWIO_LIVE_PROFILE` | 独立的 draw.io/Electron User Data 目录 | `~/.drawio-live-mcp/<端口>` |

**Windows 示例**：
```powershell
$env:DRAWIO_PATH = "D:\Apps\draw.io\draw.io.exe"
```

---

## 故障排查

- **提示找不到 `node`**：请安装 Node.js 22+，或确保 Codex 运行环境可执行 `node` 命令。
- **提示找不到 `draw.io`**：请安装桌面版 draw.io，或通过 `DRAWIO_PATH` 手动配置路径。
- **端口冲突**：无需强制设置端口，MCP 服务会自动寻找可用端口，或者手动修改 `DRAWIO_LIVE_PORT`。
- **Graph 未就绪 (Not ready)**：请关闭此前由于异常留下的 draw.io 窗口后重试。
- **安装后未查看到插件**：安装后必须重启 Codex，并在新的 Task 中使用。
- **导出失败**：请确认桌面版 draw.io 能够正常打开该文件并手动导出，且目标目录有写入权限。

---

## 安全与隐私

- 本机调试端口仅绑定于 `127.0.0.1`，绝不暴露至公网。
- 目标探测机制仅连接识别为 draw.io / diagrams.net 的页面，禁止附加至任意其他浏览器页面。
- 完全不使用系统级鼠标键盘模拟，不入侵系统其他操作。
- 不包含任何后台遥测或云端上报代码。详见 [PRIVACY.md](PRIVACY.md)。

---

## 许可证与贡献

本项目采用 [MIT 许可证](LICENSE)。欢迎提交 Issue 与 Pull Request！
