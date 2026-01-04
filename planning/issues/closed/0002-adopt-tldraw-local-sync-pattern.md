# Adopt tldraw Local Sync Pattern for Document Persistence

**Status:** `closed`
**Priority:** `high`
**Type:** `refactor`

## Description

Replace the current polling-based snapshot sync with tldraw's local sync pattern. This pattern allows sending incremental patches rather than full document snapshots, reducing IPC overhead and enabling more efficient multi-window sync.

## Context

### Current Architecture

The app currently uses a custom sync approach:

1. `SneakyFileUpdater` in the renderer polls for changes every 1 second
2. When dirty, it sends the **entire** `StoreSnapshot<TLRecord>` via `editor-update` IPC event
3. Main process stores the full snapshot in `OpenFileData.content`
4. `StoreManager` persists metadata to `open-files.json` every 1 second

**Problems with this approach:**

- Sends full snapshots even for single-record changes (inefficient)
- Custom `LocalSyncClient` stub in `useDocumentSync.ts` doesn't do real syncing
- No support for multiple windows editing the same document
- Polling interval creates latency in persisting changes

### tldraw's Local Sync Pattern

tldraw provides `TLLocalSyncClient` which:

- Sends only **diffs/patches** when records change
- Uses `BroadcastChannel` for cross-tab communication
- Batches changes efficiently
- Handles conflict resolution
- Provides `persistenceKey` for identifying documents

This pattern is designed for exactly this use case - multiple tabs/windows collaborating on the same document with local persistence.

## Acceptance Criteria

- [x] Replace custom `LocalSyncClient` with adapted tldraw sync logic
- [x] Use patch-based updates instead of full snapshots
- [x] Main process receives and applies incremental changes
- [x] Support multiple windows viewing the same file
- [x] Changes sync between windows in real-time
- [x] Unsaved changes are persisted for crash recovery
- [x] Performance improvement: reduced IPC payload size

## Technical Notes

**Affected files:**

- `src/renderer/src/hooks/useDocumentSync.ts` - Replace stub LocalSyncClient
- `src/renderer/src/routes/editor.tsx` - Remove SneakyFileUpdater polling
- `src/main/EventManager.ts` - Handle patch events instead of full snapshots
- `src/main/StoreManager.ts` - Apply patches to stored documents
- `src/types.ts` - Add new IPC event types for patches

**Key considerations:**

1. **Electron vs Browser**: tldraw's `BroadcastChannel` works between browser tabs but not Electron windows. Need to adapt the pattern to use IPC instead.

2. **Patch format**: Define a patch event type that includes:
   - Document ID
   - Added/updated records
   - Removed record IDs
   - Schema version

3. **Main process as hub**: Main process acts as the sync coordinator:
   - Receives patches from any renderer
   - Applies patches to the authoritative document state
   - Broadcasts patches to other windows with the same document open

4. **Conflict resolution**: When multiple windows edit simultaneously:
   - Last-write-wins at the record level
   - Or use tldraw's built-in conflict resolution if available

**Proposed IPC events:**

```typescript
// Renderer -> Main
type EditorPatchEvent = {
	type: 'editor-patch'
	payload: {
		id: OpenFileId
		changes: RecordsDiff<TLRecord>
		source: 'user' // distinguish from sync patches
	}
}

// Main -> Renderer
type DocumentPatchEvent = {
	type: 'document-patch'
	payload: {
		id: OpenFileId
		changes: RecordsDiff<TLRecord>
		source: WindowId // which window originated the change
	}
}
```

**Implementation approach:**

1. Study tldraw's `TLLocalSyncClient` implementation
2. Create `ElectronSyncClient` adapter that sends patches via IPC
3. Main process maintains document state and broadcasts to other windows
4. Renderer applies incoming patches (filtering out self-originated changes)
5. Remove the `SneakyFileUpdater` polling mechanism
6. Keep crash-recovery persistence but use patches instead of snapshots

## Related

- tldraw sync documentation: https://tldraw.dev/docs/sync
- `TLLocalSyncClient` in tldraw SDK
- Future: Real-time collaboration via tldraw sync server

## Implementation Plan

## Summary

Replace the polling-based full-snapshot sync with patch-based incremental sync. The main process becomes a sync hub that receives patches from renderers, applies them to document state, and broadcasts to other windows with the same document open.

## Current State

- **SneakyFileUpdater** (`editor.tsx:181-205`): Polls every 1s, sends full `StoreSnapshot<TLRecord>` via `editor-update`
- **LocalSyncClient** (`useDocumentSync.ts:35-86`): Already captures diffs via `RecordsDiff` but `onChange` just logs them (line 128-130)
- **MainManager**: Stores full snapshots in `openFiles.update()` on every `editor-update`
- **Problem**: ~1MB+ snapshots sent every second even for tiny changes

## Architecture

```
┌─────────────┐     editor-patch      ┌─────────────┐     document-patch     ┌─────────────┐
│  Window A   │ ──────────────────────►│    Main     │ ──────────────────────►│  Window B   │
│  (Editor)   │◄──────────────────────│  SyncManager │◄──────────────────────│  (Editor)   │
└─────────────┘     document-patch     └─────────────┘     editor-patch      └─────────────┘
                                              │
                                              ▼
                                       Applies patches to
                                       OpenFileData.content
```

---

## Phase 1: Add IPC Types

**File:** `src/types.ts`

Add new event types:

```typescript
// Renderer → Main: Send incremental changes
| { type: 'editor-patch'; payload: { documentId: string; changes: RecordsDiff<TLRecord>; schema: SerializedSchema; windowId: number } }

// Main → Renderer: Broadcast changes from other windows
| { type: 'document-patch'; payload: { documentId: string; changes: RecordsDiff<TLRecord>; originWindowId: number; sequence: number } }

// Renderer → Main: Register/unregister for sync
| { type: 'editor-sync-register'; payload: { documentId: string; windowId: number } }
| { type: 'editor-sync-unregister'; payload: { documentId: string; windowId: number } }

// Main → Renderer: Full state for late-joining windows
| { type: 'document-sync-state'; payload: { documentId: string; snapshot: StoreSnapshot<TLRecord>; sequence: number } }
```

---

## Phase 2: Create SyncManager

**New file:** `src/main/SyncManager.ts`

Responsibilities:

1. Track which windows have each document open (`Map<documentId, Set<windowId>>`)
2. Maintain sequence numbers per document for ordering
3. Receive patches, apply to `OpenFileData.content`, broadcast to other windows
4. Send full state to late-joining windows

Key methods:

- `registerWindow(documentId, windowId)` - Add window to sync group
- `unregisterWindow(documentId, windowId)` - Remove from sync group
- `handlePatch(documentId, changes, schema, originWindowId)` - Process incoming patch
- `applyPatchToStore(documentId, changes)` - Mutate stored snapshot
- `broadcastPatch(documentId, changes, originWindowId, sequence)` - Send to other windows

---

## Phase 3: Create ElectronSyncClient

**File:** `src/renderer/src/hooks/useDocumentSync.ts`

Replace `LocalSyncClient` with `ElectronSyncClient`:

```typescript
class ElectronSyncClient {
	constructor(store: TLStore, documentId: string, callbacks)

	// Listen to store changes, send patches via IPC
	// Listen for incoming patches, apply with mergeRemoteChanges()
	// Filter out self-originated patches using windowId
	// Track sequence numbers for ordering

	setWindowId(windowId: number) // Called after editor mounts
	close() // Cleanup and unregister
}
```

Update `useDocumentSync` hook:

- Accept `documentId` parameter
- Return `setWindowId` callback for editor to call after mount
- Handle `document-patch` and `document-sync-state` events

---

## Phase 4: Update Editor

**File:** `src/renderer/src/pages/editor.tsx`

1. **Remove** `SneakyFileUpdater` component (lines 181-205)
2. **Remove** module-level `_dirty` flag (line 24)
3. **Update** `useDocumentSync` call to pass `documentId`:
   ```typescript
   const { store, status, setWindowId } = useDocumentSync({
   	snapshot: initialFileData.content,
   	documentId: id,
   })
   ```
4. **Call** `setWindowId(initialFileData.window.id)` in `handleMount`
5. **Keep** `persist()` function for explicit save operations only

---

## Phase 5: Wire Up Main Process

**File:** `src/main/MainManager.ts`

1. Add `sync = new SyncManager(this)` to manager instances
2. Add IPC handlers:
   ```typescript
   this.events.onRendererEvent('editor-patch', ({ documentId, changes, schema, windowId }) => {
     this.sync.handlePatch(documentId, changes, schema, windowId)
   })
   this.events.onRendererEvent('editor-sync-register', ...)
   this.events.onRendererEvent('editor-sync-unregister', ...)
   ```
3. **Keep** existing `editor-update` handler for explicit saves

**File:** `src/main/WindowManager.ts`

In `handleClosed`: Call `this.mainManager.sync.unregisterWindow(fileData.id, windowId)`

---

## Phase 6: Crash Recovery

The existing crash recovery mechanism is preserved:

- `StoreManager` persists to `open-files.json` every 1 second
- `OpenFileData.content` now updated incrementally via patches instead of full replacement
- On restart, documents restored from last persisted snapshot

**Change:** Snapshots are updated more frequently (on every patch) vs. every 1 second poll

---

## Phase 7: Multi-Window Menu Option

**Files:** `src/main/MenuManager.ts`, `src/main/ActionManager.ts`

Add "Window > Open in New Window" menu option that:

1. Gets current document ID from focused window
2. Creates new editor window with same document ID
3. Registers new window with SyncManager
4. New window receives current state via `document-sync-state` event

---

## Files to Modify

| File                                        | Changes                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/types.ts`                              | Add 5 new IPC event types                                                      |
| `src/main/SyncManager.ts`                   | **New file** - sync hub class                                                  |
| `src/main/MainManager.ts`                   | Add SyncManager, add 3 IPC handlers                                            |
| `src/main/WindowManager.ts`                 | Add unregister call in handleClosed, add method to open same doc in new window |
| `src/main/MenuManager.ts`                   | Add "Open in New Window" menu item                                             |
| `src/main/ActionManager.ts`                 | Add openDocumentInNewWindow action                                             |
| `src/renderer/src/hooks/useDocumentSync.ts` | Replace LocalSyncClient with ElectronSyncClient                                |
| `src/renderer/src/pages/editor.tsx`         | Remove SneakyFileUpdater, pass documentId, call setWindowId                    |

---

## Testing Strategy

1. **Single window**: Edit document, verify patches sent (not full snapshots)
2. **Multi-window**: Open same file twice, edit in one, verify sync to other
3. **Late join**: Open document in window A, edit, open in window B, verify state sync
4. **Crash recovery**: Edit, force quit, restart, verify changes present
5. **Performance**: Compare IPC payload sizes before/after

---

## Key Decisions

1. **Main process as sync hub** (vs peer-to-peer): Single source of truth, easier crash recovery
2. **Keep `editor-update` for saves**: Explicit saves still send full snapshots for disk writes
3. **Sequence numbers** (vs vector clocks): Simple linear ordering sufficient for single hub
4. **Last-write-wins at record level**: Matches tldraw's built-in conflict resolution

---

## Implementation Order

1. Types (`src/types.ts`) - Low risk, foundation for everything
2. SyncManager (`src/main/SyncManager.ts`) - New file, no breaking changes
3. MainManager handlers - Add new handlers alongside existing
4. ElectronSyncClient - Replace stub in useDocumentSync.ts
5. Editor changes - Remove SneakyFileUpdater last (breaking change)
6. WindowManager cleanup - Small addition
7. Multi-window menu option - MenuManager + ActionManager changes
