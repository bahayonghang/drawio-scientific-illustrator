# Usage & Paced Workflow

## How to Use

1. Launch Codex and open a new session after installation.
2. Attach your target scientific reference image (PNG, JPEG, SVG, or a PDF page snippet).
3. Mention `@Draw.io Scientific Illustrator` or select the plugin from the tool selector.
4. Specify your desired pacing interval (e.g., 100 ms) and target export format.

### Recommended AI Model Configuration

For complex scientific illustrations, we recommend:
- **Model**: `GPT-5.6 Sol`
- **Reasoning Effort**: `Max`

> Note: Make sure to enable the 6-level reasoning selector in Codex settings to access the `Max` setting.

### Prompt Template

```text
Use Draw.io Scientific Illustrator. Launch the live draw.io canvas and recreate this
reference scientific figure step by step with a 100 ms delay. Control only draw.io's
own graph API; do not use OS mouse/keyboard automation and do not generate XML first.
Keep all labels, arrows, panels, and legends editable. Visually inspect and refine each
section, then save the final .drawio file and export a 2000 px PNG preview.
```

## Step-by-Step Tool Execution Sequence

When executing a drawing task, Codex typically follows this tool flow:

1. `drawio_live_launch`: Spawns or connects to the visible draw.io desktop application.
2. `drawio_live_status`: Verifies that the internal graph engine is initialized and ready.
3. `drawio_live_add_shape` / `drawio_live_add_edge` / `drawio_live_draw_sequence`: Adds editable vertices and edges to the live graph canvas.
4. `drawio_live_screenshot`: Captures a visual snapshot of the editor for AI visual verification.
5. `drawio_live_inspect` / `drawio_live_update_cell`: Fine-tunes positions, text formatting, colors, and styles.
6. `drawio_live_fit`: Adjusts canvas viewport and zoom level.
7. `drawio_live_save_snapshot`: Saves the rendered graph as a `.drawio` file.
8. `drawio_validate` & `drawio_export`: Verifies schema validity and exports final deliverables.
