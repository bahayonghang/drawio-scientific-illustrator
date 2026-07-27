# Environment & Configuration

## Environment Variables

You can customize the behavior of the `drawio-live` MCP server by setting the following environment variables prior to launching Codex:

| Variable | Description | Default Value |
|---|---|---|
| `DRAWIO_PATH` | Explicit absolute path to the draw.io desktop executable | Auto-detected |
| `DRAWIO_LIVE_PORT` | Preferred Chrome Remote Debugging port | `9333` (auto-falls back to adjacent free port) |
| `DRAWIO_LIVE_PROFILE` | Custom Electron user profile directory | `~/.drawio-live-mcp/<port>` |

## Configuration Examples

### Windows (PowerShell)

```powershell
$env:DRAWIO_PATH = "C:\Program Files\draw.io\draw.io.exe"
$env:DRAWIO_LIVE_PORT = "9444"
```

### macOS / Linux (Bash)

```bash
export DRAWIO_PATH="/Applications/draw.io.app/Contents/MacOS/draw.io"
export DRAWIO_LIVE_PORT="9444"
```

## Updating the Plugin

To update to the latest version, re-run the one-command installer script or pull the latest git commits:

```bash
cd drawio-scientific-illustrator
git pull origin main
```

Then restart Codex and open a new session.
