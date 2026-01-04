# Fix onChange Persistence in useDocumentSync

**Status:** `closed`
**Priority:** `medium`
**Type:** `bug`

## Description

The `onChange` handler in `useDocumentSync` hook logs a message but doesn't actually persist changes. This is marked with a TODO.

## Context

The sync client should persist changes to prevent data loss. Currently it only logs when changes occur.

## Acceptance Criteria

- [x] Changes are persisted when onChange fires
- [x] Debounced to avoid excessive writes
- [x] Works with the existing auto-save mechanism
- [x] No data loss on crash/unexpected close

## Technical Notes

**Affected files:**

- `src/renderer/src/hooks/useDocumentSync.ts:129` - `onChange` logs but doesn't persist

**Current code:**

```typescript
onChange: () => {
	console.log('onChange') // TODO
}
```

**Implementation approach:**

1. Determine if this should trigger auto-save or use separate mechanism
2. May need to coordinate with editor.tsx auto-save
3. Consider using the existing store persistence in main process

## Related

- Related: #0005 (Dirty tracking improvement)

## Implementation Plan

Completed as part of issue #0002 (patch-based sync pattern).

## Implementation Notes

This was addressed by the patch-based sync architecture:

1. `ElectronSyncClient` in `useDocumentSync.ts` listens to store changes and sends patches via `editor-patch` IPC events
2. `SyncManager.handlePatch()` receives patches and updates the stored snapshot with `unsavedChanges: true`
3. `StoreManager` persists all open files every 1 second to `open-files.json`

The old `onChange` callback approach was replaced entirely with a more robust patch-based system that handles multi-window sync as well.
