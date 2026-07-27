# 环境变量与配置说明

## 可用环境变量

您可以通过在启动 Codex 前设置以下环境变量来自定义 `drawio-live` MCP 服务的行为：

| 环境变量 | 作用说明 | 默认值 |
|---|---|---|
| `DRAWIO_PATH` | 显式指定 draw.io 可执行文件的绝对路径 | 自动检测标准安装目录 |
| `DRAWIO_LIVE_PORT` | 首选的 Chrome 远程调试端口 | `9333`（端口冲突时自动顺延使用可用端口） |
| `DRAWIO_LIVE_PROFILE` | 独立的 Electron User Data 隔离配置目录 | `~/.drawio-live-mcp/<端口>` |

## 配置示例

### Windows (PowerShell)

```powershell
$env:DRAWIO_PATH = "D:\Apps\draw.io\draw.io.exe"
$env:DRAWIO_LIVE_PORT = "9444"
```

### macOS / Linux (Bash)

```bash
export DRAWIO_PATH="/Applications/draw.io.app/Contents/MacOS/draw.io"
export DRAWIO_LIVE_PORT="9444"
```

## 插件更新方法

如需更新至插件的最新版本，重新运行单行安装脚本，或在 Git 仓库目录中执行更新：

```bash
cd drawio-scientific-illustrator
git pull origin main
```

更新完成后重新启动 Codex 即可。
