# Watch for file name changes (fs watch)

**Status:** `closed`
**Priority:** `medium`
**Type:** `feature`

## Description

The app should detect when a user renames a `.tldr` file externally (e.g., in Finder/Explorer) and update the window title and internal state accordingly. Currently, if a user renames a file outside the app while it's open, the app continues to display the old file name and may fail when saving.

## Context

Users often manage their files through their operating system's file manager (Finder on macOS, Explorer on Windows). When a file is renamed externally while open in tldraw-desktop, the app should:

1. Detect the rename event
2. Update the window title to reflect the new file name
3. Update internal state (`OpenFileData.filePath`, `RecentFileData.filePath`)
4. Continue to save to the correct (new) path

This improves the user experience by keeping the app synchronized with the filesystem.

## Acceptance Criteria

- [x] App detects when an open `.tldr` file is renamed externally
- [x] Window title updates to show the new file name
- [x] Internal `OpenFileData.filePath` is updated with the new path
- [x] `RecentFileData` is updated with the new path
- [x] Saving the file works correctly after rename
- [x] App handles the case where the file is moved to a different directory
- [x] App handles the case where the file is deleted externally (show appropriate dialog)
- [x] File watcher is cleaned up when window is closed
- [x] Works on macOS, Windows, and Linux

## Technical Notes

**Affected files:**

- `src/main/WindowManager.ts` - Add file watcher setup/teardown in `setupEditorWindow`
- `src/main/StoreManager.ts` - Update `filePath` in `openFiles` and `recentFiles`
- `src/types.ts` - Already has `file-path-change` event defined (lines 27-32)
- `src/renderer/src/components/EditorTitleBar.tsx` - Listens to `filePathAtom` for display
- `src/renderer/src/components/sharedAtoms.ts` - Contains `filePathAtom`

**Current behavior:**

- File path is set once when opening and never updated
- No filesystem watching is implemented
- If file is renamed/moved externally, app shows stale name and may fail to save

**Expected behavior:**

- App watches the file path for changes
- On rename/move, app updates internal state and UI
- On delete, app prompts user (similar to unsaved changes dialog)

**Implementation approach:**

- Use Node.js `fs.watch` or a library like `chokidar` for cross-platform file watching
- Set up watcher in `WindowManager.setupEditorWindow` when file has a path
- Clean up watcher in disposals array
- Send `file-path-change` event to renderer when path changes
- Handle edge cases: file deleted, moved to different directory, permissions changed

## Related

- Related: #0001 (implement rename file - internal rename vs external rename)

## Implementation Plan

### Overview

The implementation will use Node.js `fs.watch` (built-in, no additional dependencies needed) to watch for changes to open files. The watcher will be set up in `WindowManager.setupEditorWindow` and cleaned up when the window closes.

### Step 1: Create FileWatcherManager (New File)

Create `src/main/FileWatcherManager.ts` to encapsulate file watching logic:

```typescript
import fs from 'fs'
import path from 'path'
import { MainManager } from './MainManager'

export class FileWatcherManager {
	private watchers: Map<string, fs.FSWatcher> = new Map() // fileId -> watcher

	constructor(public mainManager: MainManager) {}

	dispose() {
		this.watchers.forEach((watcher) => watcher.close())
		this.watchers.clear()
	}

	watchFile(fileId: string, filePath: string): () => void
	unwatchFile(fileId: string): void
	handleFileChange(fileId: string, eventType: string, filename: string | null): void
	handleFileDeleted(fileId: string): void
	handleFileRenamed(fileId: string, newPath: string): void
}
```

### Step 2: Integrate FileWatcherManager into MainManager

Update `src/main/MainManager.ts`:

- Import and instantiate `FileWatcherManager`
- Add to initialization and disposal

### Step 3: Set Up File Watcher in WindowManager.setupEditorWindow

In `src/main/WindowManager.ts`, modify `setupEditorWindow()` (around line 153):

1. If `fileData.filePath` is not null, call `this.mainManager.fileWatcher.watchFile(fileData.id, fileData.filePath)`
2. Add the returned cleanup function to `disposals` array
3. Handle the case where `filePath` changes after initial setup (via `file-path-change` event)

### Step 4: Handle File Events

In `FileWatcherManager`, implement event handling:

**On rename detection:**

1. The original path will no longer exist
2. Scan the parent directory to find the new file name (by matching file content or using inode on POSIX systems)
3. Update `openFiles` and `recentFiles` with new path
4. Send `file-path-change` event to renderer

**On delete detection:**

1. Check if file still exists (could be a rename)
2. If truly deleted, show dialog asking user what to do:
   - "The file has been deleted. Would you like to save it again?"
   - Options: "Save As...", "Keep Editing", "Close"

### Step 5: Update Renderer to Handle Path Changes

The renderer already listens for `file-path-change` events in `src/renderer/src/pages/editor.tsx` (lines 93-97). No changes needed here.

### Step 6: Handle Edge Cases

1. **File moved to different directory**: Treat same as rename, update full path
2. **File permissions changed**: Show error dialog if file becomes unreadable
3. **Watcher cleanup on Save As**: When user does "Save As", need to:
   - Stop watching old path
   - Start watching new path
4. **Platform differences**:
   - `fs.watch` behavior varies by OS
   - On macOS, rename events include the new filename
   - On Windows/Linux, may need to detect by checking if original file exists

### Step 7: Testing Considerations

1. Add E2E test for external file rename detection
2. Test on all platforms (macOS, Windows, Linux)
3. Test rapid renames
4. Test file deletion while editing
5. Test network drives / slow filesystems

### Files to Modify

1. **`src/main/FileWatcherManager.ts`** (NEW) - File watching logic
2. **`src/main/MainManager.ts`** - Add FileWatcherManager integration
3. **`src/main/WindowManager.ts`** - Set up watchers in `setupEditorWindow`
4. **`src/main/ActionManager.ts`** - Update watcher on Save As (lines 343-374)

### Risks and Considerations

1. **Cross-platform behavior**: `fs.watch` behaves differently on different OSes. May need platform-specific handling or consider using `chokidar` library for consistency.
2. **Performance**: Watching many files could impact performance. Implement debouncing for rapid changes.
3. **Race conditions**: File rename detection requires careful timing to avoid false positives.
4. **Network drives**: File watchers may not work reliably on network-mounted drives.
