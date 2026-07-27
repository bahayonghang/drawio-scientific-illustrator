# 使用教程与步进绘图流程

## 使用步骤

1. 安装完成后，重启 Codex 并新建一个 Task 对话；
2. 上传您的科研插图参考文件（PNG、JPEG、SVG 或 PDF 论文页面截图）；
3. 输入框中提及 `@Draw.io Scientific Illustrator` 或在工具面板中勾选该插件；
4. 描述绘制要求、动画步进延时（如 100 ms）以及需要的输出格式。

### 推荐的 Codex AI 模型设置

为保证重绘复杂科学插图时的逻辑准确度与美观度，强烈建议：
- **模型**：`GPT-5.6 Sol`
- **推理等级 (Reasoning Effort)**：`Max (最高)`

> 提示：需在 Codex 设置中开启 **6 档推理等级选择器**（默认 5 档选择器不包含 Max 选项）。

### 推荐提示词模版

```text
使用 Draw.io Scientific Illustrator。启动实时 draw.io，以 100 ms 的步骤间隔逐步重绘
这张参考图。必须直接控制 draw.io 自己的画布 API，不要控制系统鼠标键盘，也不要先
生成 XML。所有文字、箭头、分区、图例都要保持可编辑。每完成一个逻辑区域就检查并
修正，最后保存 .drawio，并导出宽度为 2000 px 的 PNG 预览图。
```

## Agent 步进工具调用流程

在实际绘图任务中，Codex 会依序调用以下工具：

1. `drawio_live_launch` —— 启动或连接可见的 draw.io 窗口；
2. `drawio_live_status` —— 校验并确认图形引擎就绪；
3. `drawio_live_add_shape` / `drawio_live_add_edge` / `drawio_live_draw_sequence` —— 逐步添加并渲染图元与连线；
4. `drawio_live_screenshot` —— 截取可视化画板状态，供视觉模型对比检查；
5. `drawio_live_inspect` / `drawio_live_update_cell` —— 精细修改图元位置、尺寸、线条颜色与文字内容；
6. `drawio_live_fit` —— 调整画布视角，确保全景尽收眼底；
7. `drawio_live_save_snapshot` —— 将内存画布模型保存为 `.drawio` 文件；
8. `drawio_validate` & `drawio_export` —— 校验 XML 结构并导出目标格式图像。
