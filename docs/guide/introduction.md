# Introduction & Architecture

## What is Draw.io Scientific Illustrator?

**Draw.io Scientific Illustrator** is a specialized Codex plugin designed for scientific illustration. It enables an AI agent to draw and refine scientific diagrams **live inside the visible desktop draw.io application**.

Unlike conventional AI tools that generate raw `.drawio` XML files and ask you to open them later, this plugin connects directly to the running draw.io Graph API via a localhost Model Context Protocol (MCP) server. You can observe the illustration being built step by step in real time.

## Architectural Overview

The repository consists of four main components:

1. **`drawio-live` MCP Server**:
   - Spawns or attaches to a visible desktop draw.io window with remote debugging enabled (`--remote-debugging-port`).
   - Evaluates real-time graph operations on the active draw.io editor.
   - Captures renderer screenshots for visual inspection.

2. **`drawio-file-utils` MCP Server**:
   - Performs structural validation on saved `.drawio` XML files.
   - Triggers clean exports to target image formats (PNG, SVG, PDF, JPG).

3. **Codex Agent Skill**:
   - Guides the AI model through reference image analysis, primitive element decomposition, paced execution, section review, and interactive refinement.

4. **Codex Marketplace Package**:
   - Bundles the MCP servers, skills, and metadata into a single installable plugin unit.

```
+-------------------------------------------------------------------+
|                           Codex Agent                             |
+-------------------------------------------------------------------+
       |                                             |
       v (MCP over Stdio)                            v (Skill Prompting)
+-------------------------------+             +---------------------+
|  drawio-live & file-utils MCP |             | Scientific Skill    |
+-------------------------------+             +---------------------+
       |
       v (CDP WebSocket / Localhost)
+-------------------------------------------------------------------+
|               Visible draw.io Desktop Window (Graph API)          |
+-------------------------------------------------------------------+
```

## Key Principles

- **No OS Automation**: Does not hijack system keyboard or mouse events.
- **No Direct Blind XML Writing**: The drawing is constructed interactively inside the graph engine first.
- **Editable Primitives**: All text labels, geometric shapes, arrows, and legends remain fully editable by human researchers.
- **Localhost Only**: Zero remote server calls; no data leaves your machine.
