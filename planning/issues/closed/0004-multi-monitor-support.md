# Multi-Monitor Window Restoration

**Status:** `closed`
**Priority:** `medium`
**Type:** `enhancement`

## Description

When restoring window positions, the app should restore windows to the correct display in multi-monitor setups.

## Context

Users with multiple monitors expect windows to reopen on the same display where they were closed. Currently marked as TODO in WindowManager.

## Acceptance Criteria

- [x] Track which display a window was on when closed
- [x] Restore window to same display on reopen
- [x] Handle case where display is no longer available
- [x] Fall back gracefully to primary display

## Technical Notes

**Affected files:**

- `src/main/WindowManager.ts:167` - TODO comment: "restore window to the correct display"

**Implementation approach:**

1. Use `electron.screen.getAllDisplays()` to get display info
2. Store display ID or bounds with window state
3. On restore, find matching display or fall back to primary
4. Use `BrowserWindow.setBounds()` with display-relative coordinates

**Electron APIs:**

- `screen.getAllDisplays()`
- `screen.getDisplayMatching(rect)`
- `screen.getPrimaryDisplay()`

## Related

- None

## Implementation Plan

Implemented with three new private methods in WindowManager.ts:

1. `getDisplayForRestore()` - Finds the original display by ID or falls back to primary
2. `adjustBoundsForDisplay()` - Adjusts window bounds to fit within target display, centering if on a different display
3. `restoreWindowToDisplay()` - Combines the above to restore a window to the correct display

Updated `createEditorInNewWindow()` and `createEditorInOldEditorWindow()` to use `restoreWindowToDisplay()` instead of directly calling `setBounds()`.
