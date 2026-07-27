# 常见问题与排查指南 (FAQ)

## 常见错误与解决方案

### 1. 找不到 Node.js (`node: command not found`)

**故障现象**：启动 MCP 服务时报错提示找不到 `node` 命令。

**解决方案**：
- 前往 [Node.js 官网](https://nodejs.org/) 下载安装 Node.js 22 或更新版本；
- 确保系统环境变量 `PATH` 中已添加 `node` 的安装路径。

### 2. 找不到 draw.io 可执行文件

**故障现象**：调用 `drawio_live_launch` 时报错，提示无法定位 draw.io 安装位置。

**解决方案**：
- 确认已安装 [draw.io 桌面版](https://www.drawio.com/)；
- 在环境变量中显式配置 `DRAWIO_PATH`，填入 `draw.io.exe`（Windows）或执行文件的完整绝对路径。

### 3. 调试端口冲突

**故障现象**：提示端口 `9333` 已被占用。

**解决方案**：
- 本插件 MCP 服务会自动顺延寻找附近的可用端口（如 `9334`, `9335`）；
- 如果残留了之前异常崩溃的 draw.io 窗口，请手动将其关闭后重试。

### 4. 画布 Graph 引擎未就绪 (`ready: false`)

**故障现象**：`drawio_live_status` 返回未就绪状态。

**解决方案**：
- 关闭此前由插件拉起的失效 draw.io 窗口；
- 检查防火墙或安全软件是否拦截了本机的 `127.0.0.1` WebSocket 调试连接。

### 5. 安装完成后 Codex 对话中看不到插件或工具

**解决方案**：
- **完全重启 Codex** 应用；
- **新建一个对话 Task**（旧的 Task 会缓存历史插件列表）。
