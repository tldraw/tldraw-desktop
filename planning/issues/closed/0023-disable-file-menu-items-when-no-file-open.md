# Disable File Menu Items When No File is Open

**Status:** `closed`
**Priority:** `medium`
**Type:** `bug`

## Description

The File menu currently has Save, Save as, Close, and Rename options enabled at all times, even when no file is open (e.g., on the home screen or about/license windows). These menu items should be disabled when there's no active file to operate on.

## Context

This is a standard UX pattern in desktop applications - file operations that require an open file should be disabled when no file is open. Currently clicking these menu items when no file is open could result in errors or undefined behavior.

## Acceptance Criteria

- [x] "Save" menu item is disabled when no file is open
- [x] "Save as" menu item is disabled when no file is open
- [x] "Close" menu item is disabled when no file is open
- [x] "Rename..." menu item is disabled when no file is open
- [x] Menu items are re-enabled when a file is opened
- [x] Menu items update correctly when switching between windows (editor vs home/about/license)

## Technical Notes

**Affected files:**

- `src/main/MenuManager.ts:72-94` - Menu item definitions for Save, Save as, Close, Rename
- `src/main/StoreManager.ts:190-196` - `getActiveOpenFileData()` method can determine if a file is open

**Current behavior:**
All file menu items are always enabled, regardless of whether a file is open.

**Expected behavior:**
File-specific menu items (Save, Save as, Close, Rename) should be disabled when no file is open, and enabled when a file is open.

## Related

- Related: #0001 (implement rename file)

## Implementation Plan

### 1. Add Menu Update Method to MenuManager

**File:** `src/main/MenuManager.ts`

- Store a reference to the menu after building it (`private applicationMenu: Electron.Menu | null = null`)
- Add `updateMenuItemsEnabled()` method that:
  - Gets active file data via `this.mainManager.store.getActiveOpenFileData()`
  - Updates enabled state on menu items by ID

**Menu item enable conditions:**

| Menu Item | ID             | Enabled When                  |
| --------- | -------------- | ----------------------------- |
| Save      | `file-save`    | `fileData !== null`           |
| Save as   | `file-save-as` | `fileData !== null`           |
| Close     | `file-close`   | `fileData !== null`           |
| Rename    | `file-rename`  | `fileData?.filePath !== null` |

```typescript
updateMenuItemsEnabled() {
  if (!this.applicationMenu) return
  const fileData = this.mainManager.store.getActiveOpenFileData()
  const hasOpenFile = fileData !== null
  const isSaved = fileData?.filePath !== null

  this.applicationMenu.getMenuItemById('file-save')!.enabled = hasOpenFile
  this.applicationMenu.getMenuItemById('file-save-as')!.enabled = hasOpenFile
  this.applicationMenu.getMenuItemById('file-close')!.enabled = hasOpenFile
  this.applicationMenu.getMenuItemById('file-rename')!.enabled = isSaved
}
```

### 2. Trigger Menu Updates on Window Focus/Blur

**File:** `src/main/WindowManager.ts`

Add focus/blur handlers that call `this.mainManager.menu.updateMenuItemsEnabled()` to:

- `setupEditorWindow()` - existing editor window setup (lines ~267-300)
- `createHomeWindow()` - home window creation
- `showAboutWindow()` - about window creation
- `showLicenseWindow()` - license window creation

### 3. Trigger Menu Updates on File Open/Close

**File:** `src/main/StoreManager.ts`

In the `openFiles` onChange callback, add:

```typescript
this.mainManager.menu.updateMenuItemsEnabled()
```

This handles cases where file state changes but window focus doesn't (e.g., closing a background window).

### 4. Set Initial Menu State

**File:** `src/main/MenuManager.ts`

At the end of `initialize()`, call `this.updateMenuItemsEnabled()` to ensure menu starts with correct state.

### Edge Cases

- **Preloaded editor window:** `getActiveOpenFileData()` returns null (no file stored for PRELOAD) → menu disabled ✓
- **Multiple editor windows:** Focus events ensure correct window's state is reflected
- **File saved for first time:** openFiles update triggers menu refresh for Rename item

## Implementation Notes

...
