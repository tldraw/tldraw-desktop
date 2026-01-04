# Remove Dead Code and Unused Hooks

**Status:** `closed`
**Priority:** `low`
**Type:** `cleanup`

## Description

Several pieces of commented-out code and unused exports should be cleaned up.

## Context

Dead code adds confusion and maintenance burden. Cleaning it up improves codebase clarity.

## Acceptance Criteria

- [x] Remove commented-out asset handling in useDocumentSync.ts
- [x] Remove commented-out code in editor.tsx
- [x] Remove or document unused useMainStore hook
- [x] Remove debug console.logs (or convert to proper logging)
- [x] Verify no functionality is broken after cleanup

## Technical Notes

**Affected files:**

- `src/renderer/src/hooks/useDocumentSync.ts:99-121` - Commented asset storage code
- `src/renderer/src/pages/editor.tsx:7-8` - Commented document name code
- `src/renderer/src/pages/editor.tsx:131` - Commented asset URL code
- `src/renderer/src/hooks/useMainStore.ts` - Created but unused (useDocumentSync preferred)

**Console.logs to review:**

- `WindowManager.ts` - home-window-show, home-window-hide, editor-window-created
- `UpdateManager.ts` - Update availability checks
- `StoreManager.ts` - Error logging (keep?)
- `useDocumentSync.ts` - onChange log
- `preload/index.ts` - Error logging (keep?)

## Related

- None

## Implementation Plan

...

## Implementation Notes

...
