# Troubleshooting & FAQ

## Common Issues & Solutions

### 1. Node.js Not Found Error

**Symptom**: MCP server fails to launch with `node: command not found`.

**Solution**:
- Install Node.js 22 or newer from [nodejs.org](https://nodejs.org/).
- Ensure `node` is available in your global `PATH` environment variable.

### 2. draw.io Desktop Not Found

**Symptom**: `drawio_live_launch` reports that draw.io executable could not be located.

**Solution**:
- Ensure [draw.io desktop](https://www.drawio.com/) is installed.
- Explicitly set `DRAWIO_PATH` environment variable pointing to `draw.io.exe` (Windows) or the binary executable.

### 3. Remote Debugging Port Conflicts

**Symptom**: Server reports port `9333` is already in use.

**Solution**:
- The server will automatically search for adjacent available ports (e.g. `9334`, `9335`).
- If necessary, close lingering draw.io instances launched by previous sessions.

### 4. Graph Engine Not Ready

**Symptom**: `drawio_live_status` returns `ready: false`.

**Solution**:
- Close any stale draw.io windows started by previous plugin invocations.
- Check if your antivirus or firewall is blocking `127.0.0.1` WebSocket debugging connections.

### 5. Plugin Installed but Tools Not Visible in Codex

**Solution**:
- Restart Codex completely.
- Start a **new task** (existing tasks retain cached plugin definitions).
