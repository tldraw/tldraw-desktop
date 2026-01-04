# Open Recent Files in Native File Menu

**Status:** `closed`
**Priority:** `medium`
**Type:** `feature`

## Description

Add an "Open Recent" submenu to the native File menu that displays recently opened `.tldr` files, allowing users to quickly access files they've worked on before.

## Context

Currently, users must navigate to the home screen to see and open recent files. Having an "Open Recent" submenu in the native File menu is a standard desktop application pattern that improves workflow efficiency. This is especially useful when users have multiple files open and want to quickly switch to or open another recent file without going through the home screen.

## Acceptance Criteria

- [x] "Open Recent" submenu appears in the File menu after "Open..."
- [x] Submenu lists recent files (up to 10 most recent)
- [x] Each menu item shows the filename and full path
- [x] Clicking a recent file opens it
- [x] "Clear Recent" option at the bottom clears the recent files list
- [x] Menu updates dynamically when files are opened/closed
- [x] Works on macOS, Windows, and Linux

## Technical Notes

**Affected files:**

- `src/main/MenuManager.ts` - Add "Open Recent" submenu to File menu
- `src/main/StoreManager.ts` - Already has `getRecentFiles()` method

**Current behavior:**

- Recent files are only accessible via the home screen
- `StoreManager.recentFiles` already tracks recent files with file paths

**Expected behavior:**

- File menu should include "Open Recent >" submenu
- Submenu dynamically populated from `StoreManager.getRecentFiles()`
- Menu rebuilds when recent files change

**Implementation approach:**

- Use Electron's `Menu.buildFromTemplate` with dynamic submenu
- Listen for `recent-files-change` to rebuild the submenu
- Use `ActionManager` methods to open files when menu items clicked

## Related

- Related: N/A

## Implementation Plan

### Phase 1: Core Implementation

1. **Refactor MenuManager to support dynamic rebuilds**
   - Extract menu template building from `initialize()` into a new `rebuildMenu()` method
   - `initialize()` will call `rebuildMenu()` instead of inline template building
   - Store the template generation logic to be callable at any time

2. **Create `buildRecentFilesSubmenu()` helper method**
   - Takes `RecentFileData[]` array from `store.getRecentFiles()`
   - Returns `Electron.MenuItemConstructorOptions[]`
   - Shows top 10 recent files with filename + directory path
   - Adds separator and "Clear Recent" option at the bottom
   - If no recent files, shows disabled "No recent files" placeholder
   - Each item calls `actions.openFile(filePath)` on click

3. **Insert submenu into File menu template**
   - Add after "Open..." (line 64 in MenuManager.ts)
   - Before the separator (currently line 65)
   - Structure:
     ```
     Open Recent >
       ├─ file1.tldr - /path/to/dir
       ├─ file2.tldr - /another/path
       ├─ ─────────────
       └─ Clear Recent
     ```

4. **Connect menu rebuilds to store changes**
   - In `MenuManager.initialize()`, patch `store.recentFiles.onChange` to also call `rebuildMenu()`
   - Pattern already established: `openFiles.onChange` calls `menu.updateMenuItemsEnabled()`

5. **Implement "Clear Recent" action**
   - Click handler iterates through all recent files and removes them
   - Uses existing `store.recentFiles.remove(id)` method

### Phase 2: Edge Cases & Polish

6. **Handle file path display**
   - Format: `filename.tldr - /parent/directory`
   - Consider truncating very long paths (> 50 chars)

7. **Handle missing files gracefully**
   - `ActionManager.openFile()` already handles file-not-found errors
   - Shows appropriate error dialog to user

### Phase 3: Testing

8. **Add E2E tests**
   - Extend `base-pom.ts` with `appMenu.file.openRecent` methods
   - Test: Recent file appears after saving
   - Test: Clicking recent file opens it
   - Test: Clear Recent clears the list
   - Test: Menu updates dynamically

### Code Examples

**Submenu builder:**

```typescript
private buildRecentFilesSubmenu(): Electron.MenuItemConstructorOptions[] {
  const recentFiles = this.mainManager.store.getRecentFiles().slice(0, 10)

  if (recentFiles.length === 0) {
    return [{ label: 'No Recent Files', enabled: false }]
  }

  const items: Electron.MenuItemConstructorOptions[] = recentFiles.map((file, i) => ({
    label: `${path.basename(file.filePath)} - ${path.dirname(file.filePath)}`,
    id: `file-recent-${i}`,
    click: () => this.mainManager.actions.openFile(file.filePath),
  }))

  items.push({ type: 'separator' })
  items.push({
    label: 'Clear Recent',
    id: 'file-open-recent-clear',
    click: () => {
      const files = this.mainManager.store.getRecentFiles()
      files.forEach(f => this.mainManager.store.recentFiles.remove(f.id))
    },
  })

  return items
}
```

**Menu template insertion:**

```typescript
{
  id: 'file-open-recent',
  label: 'Open Recent',
  submenu: this.buildRecentFilesSubmenu(),
}
```

## Implementation Notes

**Completed implementation:**

### Files modified:

- `src/main/MenuManager.ts` - Added `buildRecentFilesSubmenu()` helper and `rebuildMenu()` method
- `e2e/poms/base-pom.ts` - Added `appMenu.file.openRecent` methods for e2e testing
- `e2e/tests/editor.test.ts` - Added "Open Recent Menu" test suite with 2 tests

### Key changes:

1. Refactored `initialize()` to call new `rebuildMenu()` method
2. Added `buildRecentFilesSubmenu()` that returns menu items for recent files (up to 10) with filename + directory path
3. Patched `store.recentFiles.onChange` to call `rebuildMenu()` whenever recent files change
4. "Open Recent" submenu inserted after "Open..." in File menu
5. "Clear Recent" menu item removes all recent files from the store

### E2E tests added:

- "should open recent file from File > Open Recent menu" - Verifies opening a saved file via the menu
- "should clear recent files list from File > Open Recent > Clear Recent" - Verifies clearing recent files

**No changes needed to:**

- `StoreManager.ts` - Already has `getRecentFiles()` returning sorted array
- `ActionManager.ts` - Already has `openFile(filePath)` method
- `src/types.ts` - `RecentFileData` already has all needed fields
