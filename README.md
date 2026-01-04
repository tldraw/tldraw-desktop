# tldraw desktop

An Electron application that provides an offline desktop editor for `.tldr` files using the [tldraw](https://tldraw.com) SDK. It functions like a text editor but for tldraw canvas files.

## Features

- Create and edit `.tldr` files locally
- Open multiple files in separate windows
- Auto-save and crash recovery
- Native file associations
- Auto-updates

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
npm run
```

### Development

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck              # Check both node and web
npm run typecheck:node         # Main/preload processes only
npm run typecheck:web          # Renderer process only
```

### Linting and Formatting

```bash
npm run lint                   # ESLint with auto-fix
npm run format                 # Prettier
```

### Build

```bash
# For macOS
npm run build:mac

# For Windows
npm run build:win

# For Linux
npm run build:linux
```

### E2E Tests

```bash
npm run e2e                    # Run all e2e tests
npm run e2e:ui                 # Run with Playwright UI
npm run e2e e2e/tests/editor.test.ts   # Run a single test file
npm run e2e -g "test name"     # Run a specific test by name
```

## Architecture

This is an [electron-vite](https://electron-vite.org/) project with three build targets:

### Main Process (`src/main/`)

The `MainManager` orchestrates specialized managers:

- **WindowManager** - Window creation and lifecycle
- **EventManager** - Type-safe IPC bridge
- **StoreManager** - App state persistence
- **ActionManager** - File operations (new, open, save)
- **MenuManager** - Native application menu
- **UpdateManager** - Auto-updates

### Renderer Process (`src/renderer/src/`)

React + React Router app with routes:

- `/home` - File picker and recent files
- `/f/:id` - Editor view with tldraw
- `/about`, `/license` - Info screens

### Preload (`src/preload/`)

Exposes `window.api` with type-safe IPC methods for communication between renderer and main processes.

## How It Works

When a file is loaded, the app creates a window under a route that includes the window id. When the React app loads, it runs the `onEditorReady` global method, which tells the main app to send it the data for that file. The React app then loads that file into the editor.

A hidden preloaded window is kept ready for instant new file creation. When the user creates a new file, this preloaded window becomes the new editor and a fresh preload window is created.
