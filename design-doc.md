# tldraw desktop design doc

This document is meant to describe the tldraw desktop application. The purpose of this application is to provide an offline application for editing tldraw files.

## User experience

The application should work like a simple text editor, except that instead of editing text files, a user will edit tldraw files using the tldraw SDK.

### Startup

When opening the application, the application should restore the user's **previous state**. A user's previous state includes the windows and files that the user had open when the application was last exited. If the application cannot find a state to restore, because the user has never opened a file before or because the relevant storage file was deleted, or if the restored state is empty, because the user had closed all windows individuaklly before last exiting the application, then the application should display a new unsaved file in a new window.

### Windows and files

Each open file is shown in its own window. The window allows the user to edit the file using the tldraw SDK's <Tldraw> component. A user may have as many open files as they wish. Opening a file that is already open will focus on the window where that file is being edited.

### Unsaved changes

When a file is first opened, there should be an exact match between the data in the file's .tldr file and the data in the tldraw editor. As the user makes changes, the editor's information will include new changes not present in the .tldr file. We call these "unsaved changes".

For each open file, the editor keeps a snapshot of the file's unsaved changes in a centralized store. When the file is edited, the application persists that change to the unsaved changes store. This store is baked into a local database.

When the file is saved, the application updates the file's actual .tldr file with the changes in the "unsaved changes" store. If the file has never been saved before, then the user must choose a name and location for the file. If the save has been successful, the application then clears the unsaved changes entry for that file.

It is critical that the unsaved changes be recoverable, as they are a risk for data loss.

## Functionality

### Exit

The user may exit the application. The state of the application, including any open files and unsaved changes, is persisted to be restored when the application is opened next.

### New File

A user may create a new file. This opens a new window. The window will not immediately be associated with any file on the file system; only when the file is saved should the user be prompted to choose a name and location for their file.

### Close File

A user may close the current file's window. If there are unsaved changes in the window's file, the user is prompted to save their changes or discard them.

### Open File...

A user may open one or more .tldr files from the file system. A dialog should appear where the user can select .tldr files. If multiple files are selected, each should appear in its own new window. If the selected file is already open, the window associated with that file should focus.

### Save

A user may save any unsaved changes in the current focused window's file. If the window is not yet associated with a file, the user should be prompted to choose a name and location for the new file (identical to Save as... functionality).

### Save as..

A user may save the current file as a new file. The user should be prompted to choose a name and location for the new file. Any unsaved changes will be immedately saved to the new file. The window will be associated with the new saved file.

### Rename (not yet implemented)

A user may rename the current file. File > Rename opens a rename dialog where the user can enter a new filename. The file is renamed on disk, the window title updates to reflect the new name, and both the recent files list and open files state are updated with the new path. Renaming is only available for files that have already been saved to disk.

### Home Screen

A user may navigate to the home screen at any time via File > Home. The home screen displays the tldraw logo, buttons for creating a new file or opening an existing file, and a list of recent files. If no editor windows are open and the application is activated, the home screen will appear.

### Recent Files

The home screen displays the user's five most recently modified files. A user may click on a recent file to open it. Holding the Alt/Option key reveals the full file path for each recent file. Recent files are sorted by last modified date, with the most recent at the top.

### Open in New Window

A user may open the same document in multiple windows for side-by-side editing. Changes made in one window sync to all other windows viewing the same document in real-time.

### Theme

A user may toggle between light and dark themes via File > Preferences > Change theme. The theme preference persists across application restarts and applies to all windows.

### Auto-Updates

When the application starts, it checks for available updates. If an update is available, the user is prompted to download it. Once downloaded, the user is prompted to restart the application to install the update. A user may also manually check for updates via Help > Check for Updates.

### About

A user may view application information via Help > About (or the app menu on macOS). The about screen displays the app name, version number, credits, and links to relevant resources.

### License

A user may view license information via Help > License. The license screen displays the application license and third-party license attributions.

### Keyboard Shortcuts

The application supports standard keyboard shortcuts:

- **Cmd/Ctrl+N** - New file
- **Cmd/Ctrl+O** - Open file
- **Cmd/Ctrl+S** - Save
- **Cmd/Ctrl+Shift+S** - Save as
- **Cmd/Ctrl+W** - Close file
- **Cmd/Ctrl+/** - Toggle theme

---

# Implementation Notes

## Window Management

### Multi-Monitor Support

When restoring window positions, the app restores windows to the correct display in multi-monitor setups:

- Track which display a window was on when closed (by display ID and bounds)
- Restore window to the same display on reopen
- If the original display is no longer available, fall back gracefully to the primary display
- Window bounds are adjusted to fit within the target display

### Menu State

File-specific menu items (Save, Save as, Close, Rename) are disabled when no file is open and enabled when a file is open. Menu items update correctly when switching between windows (editor vs home/about/license). The Rename menu item is only enabled when the file has been saved to disk.

### macOS Titlebar

On macOS, only the native traffic lights (close/minimize/maximize) are visible. The app uses conditional rendering to avoid duplicate window control buttons. On other platforms, custom window controls are rendered. Focus/blur states are handled by the native macOS controls.

## Document Sync

### Patch-Based Sync Architecture

The app uses a patch-based incremental sync system instead of full document snapshots:

- `ElectronSyncClient` in the renderer captures record-level diffs and sends them via `editor-patch` IPC events
- `SyncManager` in the main process acts as a sync hub, receiving patches from renderers, applying them to the authoritative document state, and broadcasting to other windows with the same document open
- Changes sync between windows in real-time with last-write-wins conflict resolution at the record level
- Unsaved changes are persisted for crash recovery (main process stores to `open-files.json` every 1 second)

### Dirty Tracking

The app uses event-driven dirty state detection:

- Dirty state is tracked via store subscriptions, not polling
- Visual dirty indicator (bullet before filename) appears in the title bar when there are unsaved changes
- macOS `setDocumentEdited` API is called for proper platform integration
- Debounced auto-save prevents excessive writes

## Home Screen

The home screen is implemented as a React route (`/home`) with:

- `TitleBar` component for window controls
- `MainButtons` component with New File and Open File buttons
- `RecentFiles` component displaying up to 5 recent files sorted by `lastModified`
- Alt/Option key listener to toggle file path visibility
- IPC events: `home-loaded`, `home-ready-to-show`, `home-new-file`, `home-open-file`, `home-open-recent-file`

## Recent Files

Recent files are stored in `StoreManager` and persisted to disk:

- `recentFiles` store holds `RecentFileData` entries with `filePath` and `lastModified`
- Files are added to recent files when opened or saved
- The home screen displays the 5 most recent, filtered to only include files with valid paths
- Recent files are updated when a file is renamed (old path removed, new path added)

## Theme Preferences

Theme preference is stored in `StoreManager.userPreferences`:

- `theme` field can be `'light'` or `'dark'`
- Toggle via File > Preferences > Change theme (Cmd/Ctrl+/)
- Theme is broadcast to all windows via `preferences-changed` IPC event
- Renderer subscribes to preference changes and updates CSS variables accordingly

## Auto-Updates

The `UpdateManager` handles automatic updates using `electron-updater`:

- Checks for updates on startup and via Help > Check for Updates
- `autoDownload` is disabled; user is prompted before downloading
- `autoInstallOnAppQuit` is enabled for seamless updates
- Supports private GitHub repos via `GH_TOKEN` environment variable
- Shows dialog prompts for "Update Available" and "Update Ready" states

## Information Screens

### About Page

The About page (Help > About tldraw) displays:

- App logo (TldrawLogo component centered at top)
- Current version number from package.json (via `__APP_VERSION__` Vite constant)
- Description with attribution to the tldraw SDK
- Links section with GitHub repository, SDK documentation, and tldraw.com
- Footer with dynamic year and copyright
- Styled consistently with app theme (dark/light mode support)

### License Page

The License page displays legal and licensing information:

- App license (MIT or similar)
- Third-party license attribution for major dependencies (tldraw, Electron, React)
- Scrollable content for long license text
- Styled consistently with app theme

### Error Page

The error boundary displays a styled error UI when errors occur:

- Includes title bar for window controls
- Shows "Something went wrong" heading
- Error message and stack trace visible only in development mode (hidden in production)
- Recovery buttons: "Go Home" and "Reload"
- Handles both Error objects and string errors gracefully
- Styled consistently with the app (uses existing color variables and patterns)

## E2E Testing

### Test Infrastructure

The e2e test suite uses Playwright with:

- Page Object Models (POMs) for home, editor, license, and about screens
- Custom fixtures providing `app`, `homeWindow`, and `homePom`
- Dialog stubbing via `electron-playwright-helpers` for file open/save tests
- Video recording and trace capture on first retry for CI debugging
- Artifact upload for test failures in CI
