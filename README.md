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

The server starts automatically when the app launches (default port 7236, falls back to a random port if taken). Connection details are written to:

- **macOS**: `~/Library/Application Support/tldraw/server.json`
- **Windows**: `%APPDATA%/tldraw/server.json`
- **Linux**: `~/.config/tldraw/server.json`

The `server.json` file contains:

```json
{
  "port": 7236,
  "pid": 12345
}
```

### API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | API documentation (plain text) |
| `GET` | `/api/llms` | tldraw SDK documentation (llms-full.txt) |
| `GET` | `/api/doc` | List all open documents (supports `?name=` filter) |
| `GET` | `/api/doc/:id/shapes` | Get all shapes on the current page |
| `GET` | `/api/doc/:id/screenshot` | Screenshot of the canvas as JPEG |
| `POST` | `/api/doc/:id/exec` | Execute arbitrary editor code |
| `POST` | `/api/doc/:id/actions` | Execute structured canvas actions |

### Screenshots

`GET /api/doc/:id/screenshot` supports query parameters:

- `size` - `small` (768px), `medium` (1536px), `large` (3072px), `full` (5000px)
- `bounds` - Crop to specific area: `bounds=x,y,w,h`

### Actions

`POST /api/doc/:id/actions` accepts a JSON body with an `actions` array. Each action has a `_type` field:

`create`, `update`, `delete`, `clear`, `move`, `place`, `label`, `align`, `distribute`, `stack`, `bringToFront`, `sendToBack`, `resize`, `rotate`, `pen`, `setMyView`

### Example usage

```bash
# Read server connection info
cat ~/Library/Application\ Support/tldraw/server.json

# List open documents
curl http://localhost:7236/api/doc

# Get shapes from a document
curl http://localhost:7236/api/doc/{id}/shapes

# Take a screenshot
curl http://localhost:7236/api/doc/{id}/screenshot?size=medium -o screenshot.jpg

# Execute editor code
curl -X POST http://localhost:7236/api/doc/{id}/exec \
  -H 'Content-Type: application/json' \
  -d '{"code": "return editor.getCurrentPageShapeIds().size"}'
```

## Development

Source code lives in the [`tldraw-internal`](https://github.com/tldraw/tldraw-internal) monorepo at `apps/public/desktop/`.

## License

This project is not open source. All rights reserved.
