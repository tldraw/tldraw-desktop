# Implement File Rename Feature

**Status:** `closed`
**Priority:** `high`
**Type:** `feature`

## Description

The rename file feature is stubbed in the menu but not implemented. Selecting File > Rename currently returns a "Not implemented" error.

## Context

Users expect to rename `.tldr` files directly from the app without using Finder/Explorer. The menu item exists but the underlying functionality is missing.

## Acceptance Criteria

- [x] File > Rename opens a rename dialog
- [x] User can enter a new filename
- [x] File is renamed on disk
- [x] Window title updates to reflect new name
- [x] Recent files list updates with new path
- [x] Open files state updates with new path

## Technical Notes

**Affected files:**

- `src/main/ActionManager.ts:165` - `renameCurrentFile()` returns error
- `src/main/MenuManager.ts` - Menu item triggers action
- `src/main/StoreManager.ts` - Update file paths in store

**Implementation approach:**

1. Show native dialog to get new filename
2. Use `fs.rename()` to move file on disk
3. Update `OpenFileData` with new path
4. Broadcast `file-path-change` event to renderer
5. Update recent files with new path

## Related

- Related: Multi-file rename (future)

## Implementation Plan

1. **Implement `renameCurrentFile()` in ActionManager.ts**
   - Check for active file and existing file path (cannot rename unsaved files)
   - Show save dialog to get new filename
   - Use `fs.rename()` to move file on disk
   - Update `openFiles` store with new path
   - Update `recentFiles` store (remove old entry, create new with new path)
   - Send `file-path-change` event to renderer

2. **No changes needed to other files:**
   - MenuManager.ts already has the menu item configured
   - StoreManager.ts already has all required methods
   - types.ts already has `file-path-change` event
   - Renderer already handles `file-path-change` event

3. **Verify with typecheck and lint**

## Implementation Notes

**Files modified:**

- `src/main/ActionManager.ts` - Implemented `renameCurrentFile()` method
- `e2e/poms/base-pom.ts` - Added `appMenu.file.rename()` helper
- `e2e/poms/editor-pom.ts` - Added `menu.rename()` helper
- `e2e/tests/editor.test.ts` - Added e2e test for rename functionality

**Implementation details:**

1. The rename function uses `dialog.showSaveDialog()` with the existing file path as the default
2. After renaming on disk with `fs.rename()`, the function:
   - Stops file watching on the old path
   - Updates the openFiles store with the new path
   - Removes the old recent file entry and creates a new one with the new path
   - Sends `file-path-change` event to update the renderer/window title
   - Starts file watching on the new path
3. Error handling restores file watching on the original path if rename fails
4. Unsaved files cannot be renamed (returns error)

**Manual testing:**

Run `npm run dev` and:

1. Create a new file (File > New)
2. Save the file (File > Save)
3. Rename the file (File > Rename)
4. Verify window title updates
5. Check recent files list shows new path
