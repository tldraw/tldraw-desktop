# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

tldraw-desktop is an Electron application that provides an offline desktop editor for `.tldr` files using the tldraw SDK. It functions like a text editor but for tldraw canvas files.

## Commands

```bash
# Install dependencies
npm

# Development
npm dev

# Type checking
npm typecheck              # Check both node and web
npm typecheck:node         # Main/preload processes only
npm typecheck:web          # Renderer process only

# Linting and formatting
npm lint                   # ESLint with auto-fix
npm format                 # Prettier

# Build
npm build:mac              # macOS build
npm build:win              # Windows build
npm build:linux            # Linux build

# E2E tests (builds first, then runs Playwright)
npm e2e                    # Run all e2e tests
npm e2e:ui                 # Run with Playwright UI

# Run a single test file
npm e2e e2e/tests/editor.test.ts

# Run a specific test by name
npm e2e -g "should open to an empty project"

# Activity log (see Activity Log section below)
```

## Architecture

This is an electron-vite project with three separate build targets:

### Main Process (`src/main/`)

Entry point: `index.ts` → `MainManager`

The `MainManager` orchestrates six specialized managers:

- **WindowManager**: Handles window creation, lifecycle, and preloaded editor windows
- **EventManager**: Type-safe IPC bridge between main and renderer processes
- **StoreManager**: Persists app state (open files, recent files, user preferences)
- **ActionManager**: File operations (new, open, save, save-as)
- **MenuManager**: Native application menu
- **UpdateManager**: Auto-updates via electron-updater

### Renderer Process (`src/renderer/src/`)

React + React Router app with lazy-loaded routes:

- `/home` - File picker/recent files screen
- `/f/:id` - Editor view with tldraw component
- `/about`, `/license` - Info screens

Key pattern: A hidden preloaded window (`/f/PRELOAD`) is kept ready for instant new file creation. When the user creates a new file, this preloaded window becomes the new editor and a fresh preload window is created.

### Preload (`src/preload/`)

Exposes `window.api` with type-safe IPC methods:

- `sendRendererEventToMain(eventName, payload)` - Renderer → Main
- `onMainEvent(eventName, callback)` - Main → Renderer subscription

### IPC Event System (`src/types.ts`)

All IPC communication uses typed events defined in `MainEvent` and `RendererEvent` union types. The flow:

1. Renderer sends event via `window.api.sendRendererEventToMain`
2. Main handles via `EventManager.onRendererEvent`
3. Main responds via `EventManager.sendMainEventToRenderer`

### Data Model

- **OpenFileData**: Currently open files (may be unsaved, stored in-memory)
- **RecentFileData**: Previously opened files with file paths
- **TldrFileData**: The actual `.tldr` file format (tldraw records + schema)

Unsaved changes are persisted to a local store to prevent data loss on crash.

## E2E Tests (`e2e/`)

**⚠️ The full e2e suite takes ~10 minutes to run. Do not run `npm e2e` without arguments. Instead, run specific tests:**

```bash
# Run a single test file
npm e2e e2e/tests/editor.test.ts

# Run a specific test by name
npm e2e -g "should open to an empty project"
```

Uses Playwright with Page Object Models:

- `poms/home-pom.ts` - Home screen interactions
- `poms/editor-pom.ts` - Editor interactions
- `poms/base-pom.ts` - Base class with shared app menu interactions

Tests use custom fixtures from `setup-test.ts` which provides `app`, `homeWindow`, and `homePom`. Use the static `After` methods on POMs (e.g., `EditorPOM.After(app, () => ...)`) to wait for a new window to open after an action.

Tests require `--playwright` flag which enables remote debugging port 9222.

## Activity Log

Record brief notes about your work in `LOG.md`. Think of it like a microblog—short entries that might be useful context for future sessions.

To add an entry:

```bash
echo "- $(date -u +'%Y-%m-%d %H:%M:%S UTC'): <message>" >> LOG.md
```

Examples:

```
- 2026-01-03 12:00:00 UTC: fixed race condition in WindowManager
- 2026-01-03 14:30:00 UTC: migrated from eslint 8 to flat config
- 2026-01-03 16:45:00 UTC: investigated issue 0003, root cause is stale preload window
```

Log when you:

- Complete a significant change
- Discover something non-obvious about the codebase
- Make a decision that future sessions should know about
- Hit a dead end worth remembering

To search the log:

```bash
grep "WindowManager" LOG.md    # Find entries mentioning a topic
tail -20 LOG.md                 # Recent entries
```
