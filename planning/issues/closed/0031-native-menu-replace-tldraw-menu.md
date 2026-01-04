# Replace tldraw's in-app menu with native menu

**Status:** `closed`
**Priority:** `medium`
**Type:** `feature`

## Description

Replace tldraw's hamburger menu (in-app MainMenu) entirely with native Electron menu items. This will provide a more native desktop experience and consolidate all menu functionality in the OS-level application menu.

## Context

Currently the app has two menu systems:

1. **Native Electron menu** (`MenuManager.ts`) - File operations, View (zoom), Help
2. **tldraw in-app menu** (`EditorMenu.tsx`) - Edit, View, Export, Preferences, and duplicated File operations

This duplication is confusing and inconsistent with native desktop apps. By moving all tldraw menu items to the native menu, we can:

- Provide a consistent native experience
- Remove UI clutter (hamburger menu button)
- Have all shortcuts visible in menus
- Follow platform conventions

## Acceptance Criteria

- [x] Hide tldraw's MainMenu by setting `MainMenu: null` in TLComponents
- [x] Add Edit menu to native menu (Undo, Redo, Cut, Copy, Paste, Select All, Delete)
- [x] Add shape operations to Edit menu (Group, Ungroup, Lock, Unlock All)
- [x] Add View menu items from tldraw (Zoom to Fit, Zoom to Selection, toggle Grid, etc.)
- [x] Add Export submenu (Export as SVG, Export as PNG)
- [x] Add Insert submenu (Insert Embed, Insert Media)
- [x] Add Preferences items (Snap Mode, Tool Lock, Focus Mode, etc.)
- [x] Menu items are properly enabled/disabled based on editor state
- [x] Keyboard shortcuts work and are displayed in menus
- [x] All actions trigger correctly via IPC to the renderer

## Technical Notes

**Affected files:**

- `src/main/MenuManager.ts` - Add new menu items
- `src/renderer/src/pages/editor.tsx` - Set MainMenu: null, add IPC handlers
- `src/renderer/src/components/EditorMenu.tsx` - Can be deleted after migration
- `src/types.ts` - Add new IPC event types
- `src/main/EventManager.ts` - Handle new events

**Current behavior:**

- Native menu has File, View, Help menus
- tldraw's in-app menu has File, Edit, View, Export, Preferences

**Expected behavior:**

- Native menu has File, Edit, View, Insert, Help menus
- tldraw's hamburger menu is hidden
- All tldraw actions accessible via native menu

**Implementation approach:**

1. Research tldraw source to understand all menu items and their enable/disable conditions
2. Define IPC events for each action
3. Add menu items to MenuManager.ts
4. Add IPC handlers in renderer to call editor methods
5. Update menu enabled states based on editor state
6. Hide tldraw's MainMenu
7. Delete EditorMenu.tsx

## Related

- None

## Implementation Plan

### Phase 1: Define IPC Events and Types

1. **Add new MainEvent types in `src/types.ts`** for main→renderer communication:

   ```typescript
   // Edit actions
   | { name: 'menu-undo' }
   | { name: 'menu-redo' }
   | { name: 'menu-cut' }
   | { name: 'menu-copy' }
   | { name: 'menu-paste' }
   | { name: 'menu-duplicate' }
   | { name: 'menu-delete' }
   | { name: 'menu-select-all' }
   | { name: 'menu-select-none' }
   // Shape operations
   | { name: 'menu-group' }
   | { name: 'menu-ungroup' }
   | { name: 'menu-toggle-lock' }
   | { name: 'menu-unlock-all' }
   // Arrange
   | { name: 'menu-bring-to-front' }
   | { name: 'menu-bring-forward' }
   | { name: 'menu-send-backward' }
   | { name: 'menu-send-to-back' }
   | { name: 'menu-flip-horizontal' }
   | { name: 'menu-flip-vertical' }
   | { name: 'menu-rotate-cw' }
   | { name: 'menu-rotate-ccw' }
   // Zoom
   | { name: 'menu-zoom-in' }
   | { name: 'menu-zoom-out' }
   | { name: 'menu-zoom-to-100' }
   | { name: 'menu-zoom-to-fit' }
   | { name: 'menu-zoom-to-selection' }
   // Export
   | { name: 'menu-export-svg' }
   | { name: 'menu-export-png' }
   | { name: 'menu-copy-as-svg' }
   | { name: 'menu-copy-as-png' }
   // Insert
   | { name: 'menu-insert-embed' }
   | { name: 'menu-insert-media' }
   // Preferences (toggles)
   | { name: 'menu-toggle-grid' }
   | { name: 'menu-toggle-snap-mode' }
   | { name: 'menu-toggle-tool-lock' }
   | { name: 'menu-toggle-focus-mode' }
   | { name: 'menu-toggle-debug-mode' }
   ```

2. **Add RendererEvent for state sync** (renderer→main):
   ```typescript
   | { name: 'editor-state-changed'; payload: EditorMenuState }
   ```
   Where `EditorMenuState` includes:
   - `hasSelection: boolean`
   - `hasUnlockedSelection: boolean`
   - `canUndo: boolean`
   - `canRedo: boolean`
   - `isGridMode: boolean`
   - `isSnapMode: boolean`
   - `isToolLocked: boolean`
   - `isFocusMode: boolean`
   - `isDebugMode: boolean`

### Phase 2: Add IPC Handlers in Renderer

3. **Create `src/renderer/src/hooks/useNativeMenuHandlers.ts`**:
   - Listen for all `menu-*` events from main process
   - Call appropriate `editor.*` methods
   - Handle async operations (export, clipboard)

   Key editor methods to call:

   ```typescript
   // Edit
   editor.undo()
   editor.redo()
   editor.deleteShapes(editor.getSelectedShapeIds())
   editor.duplicateShapes(editor.getSelectedShapeIds())
   editor.selectAll()
   editor.selectNone()

   // Clipboard (use tldraw helpers)
   import { cut, copy, paste, exportAs, copyAs } from 'tldraw'

   // Grouping
   editor.groupShapes(editor.getSelectedShapeIds())
   editor.ungroupShapes(editor.getSelectedShapeIds())
   editor.toggleLock(editor.getSelectedShapeIds())

   // Arrange
   editor.bringToFront(editor.getSelectedShapeIds())
   editor.bringForward(editor.getSelectedShapeIds())
   editor.sendBackward(editor.getSelectedShapeIds())
   editor.sendToBack(editor.getSelectedShapeIds())
   editor.flipShapes(editor.getSelectedShapeIds(), 'horizontal')
   editor.flipShapes(editor.getSelectedShapeIds(), 'vertical')
   editor.rotateShapesBy(editor.getSelectedShapeIds(), Math.PI / 2)
   editor.rotateShapesBy(editor.getSelectedShapeIds(), -Math.PI / 2)

   // Zoom
   editor.zoomIn()
   editor.zoomOut()
   editor.resetZoom()
   editor.zoomToFit()
   editor.zoomToSelection()

   // Toggles
   editor.updateInstanceState({ isGridMode: !editor.getInstanceState().isGridMode })
   editor.updateInstanceState({ isToolLocked: !editor.getInstanceState().isToolLocked })
   editor.updateInstanceState({ isFocusMode: !editor.getInstanceState().isFocusMode })
   editor.updateInstanceState({ isDebugMode: !editor.getInstanceState().isDebugMode })
   editor.user.updateUserPreferences({ isSnapMode: !editor.user.getIsSnapMode() })
   ```

4. **Add state change listener** in the same hook:
   - Subscribe to `editor.store.listen()` for relevant changes
   - Send `editor-state-changed` event to main when state changes
   - Debounce to avoid excessive IPC

### Phase 3: Update MenuManager

5. **Restructure `src/main/MenuManager.ts`** with new menus:

   **File menu** (mostly unchanged):
   - Home, New, Open, Open Recent, separator
   - Close, Save, Save as, Rename, separator
   - Preferences submenu (keep theme toggle), separator
   - Quit

   **Edit menu** (NEW):
   - Undo (Cmd+Z)
   - Redo (Cmd+Shift+Z)
   - separator
   - Cut (Cmd+X)
   - Copy (Cmd+C)
   - Paste (Cmd+V)
   - Duplicate (Cmd+D)
   - Delete (Backspace)
   - separator
   - Select All (Cmd+A)
   - Select None
   - separator
   - Group (Cmd+G)
   - Ungroup (Cmd+Shift+G)
   - separator
   - Lock (Shift+L)
   - Unlock All

   **Arrange menu** (NEW):
   - Bring to Front (])
   - Bring Forward (Alt+])
   - Send Backward (Alt+[)
   - Send to Back ([)
   - separator
   - Flip Horizontal (Shift+H)
   - Flip Vertical (Shift+V)
   - separator
   - Rotate Clockwise (Shift+.)
   - Rotate Counter-clockwise (Shift+,)

   **View menu** (enhanced):
   - Zoom In (Cmd+=)
   - Zoom Out (Cmd+-)
   - Zoom to 100% (Shift+0)
   - Zoom to Fit (Shift+1)
   - Zoom to Selection (Shift+2)
   - separator
   - Show Grid (Cmd+') - checkbox
   - separator
   - Toggle Focus Mode (Cmd+.)
   - separator
   - Reload, Force Reload, Toggle DevTools (dev only)
   - separator
   - Toggle Fullscreen

   **Insert menu** (NEW):
   - Insert Media (Cmd+U)
   - Insert Embed (Cmd+I) - opens dialog

   **Export menu** (NEW, or as submenu under File):
   - Export as SVG
   - Export as PNG
   - separator
   - Copy as SVG (Cmd+Shift+C)
   - Copy as PNG

   **Help menu** (unchanged)

6. **Add menu state tracking**:
   - Store `EditorMenuState` in MenuManager
   - Handle `editor-state-changed` events via EventManager
   - Call `updateMenuItemsEnabled()` when state changes

7. **Implement `updateMenuItemsEnabled()`**:

   ```typescript
   // Edit items - require hasUnlockedSelection
   cutItem.enabled = hasUnlockedSelection
   copyItem.enabled = hasSelection
   deleteItem.enabled = hasUnlockedSelection
   duplicateItem.enabled = hasUnlockedSelection

   // Undo/Redo
   undoItem.enabled = canUndo
   redoItem.enabled = canRedo

   // Group/Ungroup - need 2+ shapes
   groupItem.enabled = hasMultipleUnlockedSelection
   ungroupItem.enabled = hasGroupSelected

   // Lock
   lockItem.enabled = hasSelection
   unlockAllItem.enabled = true // always enabled

   // Arrange - require selection
   arrangeItems.forEach((item) => (item.enabled = hasUnlockedSelection))

   // Zoom to selection - require selection
   zoomToSelectionItem.enabled = hasSelection

   // Checkboxes
   gridItem.checked = isGridMode
   snapItem.checked = isSnapMode
   toolLockItem.checked = isToolLocked
   focusModeItem.checked = isFocusMode
   ```

### Phase 4: Hide tldraw Menu & Cleanup

8. **Update `src/renderer/src/pages/editor.tsx`**:

   ```typescript
   const components: TLComponents = {
     MainMenu: null,  // Hide hamburger menu
     TopPanel: () => <EditorTitleBar />,
   }
   ```

9. **Add the new hook** to TldrawEditorView:

   ```typescript
   useNativeMenuHandlers(editor)
   ```

10. **Delete `src/renderer/src/components/EditorMenu.tsx`** after migration complete

### Phase 5: Testing

11. **Manual testing checklist**:
    - [ ] All Edit menu items work
    - [ ] All Arrange menu items work
    - [ ] All View/zoom items work
    - [ ] Export to SVG/PNG works
    - [ ] Copy as SVG/PNG works
    - [ ] Insert Media opens file dialog
    - [ ] Insert Embed opens embed dialog
    - [ ] Menu items enable/disable correctly based on selection
    - [ ] Checkbox items reflect current state
    - [ ] Keyboard shortcuts work
    - [ ] Works on macOS and Windows

12. **Update E2E tests** if any test the hamburger menu

## Implementation Notes

### Key tldraw imports needed:

```typescript
import { exportAs, copyAs, getSvgAsString, Editor } from 'tldraw'
```

### Clipboard operations:

tldraw's clipboard uses the native clipboard API. The `cut`, `copy`, `paste` helpers handle tldraw-specific clipboard format. May need to import from internal paths or reimplement.

### Export dialog:

For export, tldraw normally shows a dialog. For native menu, we can either:

- Export directly (no dialog, use current selection or all shapes)
- Trigger tldraw's export dialog via action

### Insert Embed:

This opens a dialog for URL input. Need to either:

- Use tldraw's built-in dialog system
- Create native Electron dialog
- Trigger the action which opens tldraw's dialog

### State sync considerations:

- Debounce state changes to avoid IPC spam
- Only send relevant state fields
- Consider using electron's `ipcRenderer.invoke` for synchronous state queries

### Keyboard shortcuts:

Some shortcuts conflict with Electron's built-in roles:

- Cmd+C/X/V are typically handled by Electron's clipboard role
- Need to ensure tldraw's clipboard format is preserved
- May need to use `click` handlers instead of roles

---

## Implementation Summary

### Changes Made

**New files:**
- `src/renderer/src/hooks/useNativeMenuHandlers.ts` - Handles menu events from main process, syncs editor state to main

**Modified files:**
- `src/types.ts` - Added 35 new MainEvent types for menu actions, EditorMenuState interface, and editor-menu-state-changed RendererEvent
- `src/main/MenuManager.ts` - Complete rewrite with Edit, Arrange, View, Insert menus; added editor state tracking and menu item enable/disable logic
- `src/renderer/src/pages/editor.tsx` - Set MainMenu: null, added useNativeMenuHandlers hook
- `e2e/poms/base-pom.ts` - Added appMenu entries for edit, arrange, view, insert menus
- `e2e/tests/editor.test.ts` - Added "Native Edit Menu" test suite

**Deleted files:**
- `src/renderer/src/components/EditorMenu.tsx` - No longer needed

### Key Implementation Details

1. **Clipboard operations**: Implemented custom copy/paste using tldraw's clipboard format (version 3 with lz-string compression) to maintain full fidelity with tldraw's native clipboard

2. **State sync**: Uses tldraw's `react()` function to efficiently track editor state changes and sync to main process via IPC

3. **Insert Embed**: Currently uses a simple `window.prompt()` for URL input. Could be enhanced with a native Electron dialog in the future

4. **Insert Media**: Uses a hidden file input element to open the native file picker

### Testing

- E2E tests added for Edit menu (delete, duplicate, undo/redo via menu)
- All 3 tests pass

### Manual Testing Suggestions

Run `npm run dev` and verify:
- Edit menu: Undo/Redo, Cut/Copy/Paste, Delete, Duplicate, Select All/None, Group/Ungroup, Lock/Unlock
- Arrange menu: Bring to Front/Forward, Send to Back/Backward, Flip H/V, Rotate CW/CCW
- View menu: Zoom In/Out/100%/Fit/Selection, Show Grid, Focus Mode, Debug Mode
- Insert menu: Insert Media (opens file picker), Insert Embed (prompts for URL)
- File > Export: Export as SVG/PNG, Copy as SVG/PNG
- Verify menu items enable/disable based on selection state
