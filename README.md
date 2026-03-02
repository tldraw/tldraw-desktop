# tldraw desktop

A desktop editor for `.tldr` files, built with [tldraw](https://tldraw.dev) and Electron.

## Download

Get the latest release from the [Releases page](https://github.com/tldraw/tldraw-desktop/releases/latest).

| Platform | Download |
| --- | --- |
| macOS (Apple Silicon + Intel) | `tldraw-{version}-universal.dmg` |
| Windows x64 | `tldraw-{version}-win-x64.exe` |
| Windows ARM64 | `tldraw-{version}-win-arm64.exe` |
| Linux x64 | `tldraw-{version}-linux-x64.AppImage` or `.deb` |
| Linux ARM64 | `tldraw-{version}-linux-arm64.AppImage` |

## Auto-updates

The app checks for updates on launch. When a new version is available, you'll be prompted to download and install it.

## Local Canvas API

The desktop app runs a local HTTP server that exposes a Canvas API for programmatic access to your tldraw documents. This enables integrations with AI coding assistants and other tools.

The server starts automatically when the app launches. Connection details are written to:

- **macOS**: `~/Library/Application Support/tldraw/server.json`
- **Windows**: `%APPDATA%/tldraw/server.json`
- **Linux**: `~/.config/tldraw/server.json`

The `server.json` file contains:

```json
{
  "port": 32832,
  "url": "http://localhost:32832"
}
```

### API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | API documentation and available endpoints |
| `GET` | `/api/windows` | List all open editor windows |
| `GET` | `/api/windows/:id` | Get window details |
| `GET` | `/api/windows/:id/canvas` | Get the full canvas (all shapes) as JSON |
| `GET` | `/api/windows/:id/canvas/svg` | Export canvas as SVG |
| `GET` | `/api/windows/:id/canvas/image` | Export canvas as PNG |
| `GET` | `/api/windows/:id/selection` | Get currently selected shapes |
| `POST` | `/api/windows/:id/canvas` | Create shapes on the canvas |
| `PATCH` | `/api/windows/:id/canvas` | Update existing shapes |
| `DELETE` | `/api/windows/:id/canvas` | Delete shapes by ID |
| `POST` | `/api/windows/:id/exec` | Execute arbitrary tldraw editor commands |

### Example usage

```bash
# Read server connection info
cat ~/Library/Application\ Support/tldraw/server.json

# List open windows
curl http://localhost:32832/api/windows

# Get all shapes from a window
curl http://localhost:32832/api/windows/{id}/canvas

# Export as SVG
curl http://localhost:32832/api/windows/{id}/canvas/svg
```

## Development

Source code lives in the [`tldraw-internal`](https://github.com/tldraw/tldraw-internal) monorepo at `apps/public/desktop/`.

## License

This project is not open source. All rights reserved.
