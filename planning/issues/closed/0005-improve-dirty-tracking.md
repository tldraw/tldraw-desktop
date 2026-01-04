# Improve Editor Dirty Tracking

**Status:** `closed`
**Priority:** `medium`
**Type:** `enhancement`

## Description

The current dirty tracking mechanism in the editor uses polling/debounce and is marked with a TODO to "improve this".

## Context

Efficient dirty tracking is important for:

- Showing unsaved indicator in title bar
- Prompting before close with unsaved changes
- Performance (avoiding unnecessary save operations)

## Acceptance Criteria

- [x] Remove polling in favor of event-driven approach
- [x] Accurate dirty state detection
- [x] No performance regression
- [x] Properly debounced auto-save still works

## Technical Notes

**Affected files:**

- `src/renderer/src/pages/editor.tsx:185` - TODO: "improve this"

**Current implementation:**

- Uses 1000ms debounce on dirty tracking
- Generates snapshot on every change (noted as expensive)

**Potential improvements:**

1. Use tldraw's built-in change detection
2. Compare document hash instead of full snapshot
3. Track dirty state via store subscription
4. Only generate snapshot when actually saving

## Related

- Related: #0006 (onChange persistence)

## Implementation Plan

1. **Add new `document-dirty-change` MainEvent type** in `src/types.ts`
2. **Add helper method in StoreManager** to detect dirty state transitions and send notifications + call macOS `setDocumentEdited` API
3. **Update SyncManager and ActionManager** to use the new notification method
4. **Add `unsavedChangesAtom`** to `src/renderer/src/components/sharedAtoms.ts`
5. **Subscribe to dirty state changes** in `src/renderer/src/pages/editor.tsx`
6. **Display dirty indicator** in `EditorTitleBar.tsx` (bullet before filename)
7. **Clean up unused `dirtyRef`** from `src/preload/index.d.ts`
8. **Add CSS styling** for the dirty indicator
