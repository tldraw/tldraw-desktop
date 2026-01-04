# Refactor Editor Lifecycle to Custom Hooks

**Status:** `closed`
**Priority:** `medium`
**Type:** `cleanup`

## Description

Refactor `editor.tsx` to replace the "Sneaky" components (`SneakyFileUpdater`, `SneakyDarkModeSync`) with proper custom hooks. These components render `null` and exist only to run effects - a code smell indicating the logic doesn't belong in the component tree.

## Context

The current architecture has imperative lifecycle logic shoehorned into React's declarative component model. This causes multiple problems:

- **Global mutable state** (`lastModified`, `_dirty`) shared across all editor instances
- **Stale closures** in effects with incorrect/incomplete dependency arrays
- **Cleanup issues** (`window.tldraw` is never cleared on unmount)
- **Scattered effects** with unclear ownership across multiple components
- **Empty catch blocks** that silently swallow errors

The "Sneaky" naming itself acknowledges these components are a workaround. A custom hook is the right abstraction for imperative side-effect management.

## Acceptance Criteria

- [x] Remove `SneakyFileUpdater` component, replace with hook
- [x] Remove `SneakyDarkModeSync` component, replace with hook
- [x] Eliminate global `lastModified` and `_dirty` variables
- [x] Move state into refs scoped to each editor instance
- [x] Proper cleanup of `window.tldraw` on unmount
- [x] Fix dependency arrays to include all referenced values
- [x] Handle/log errors instead of empty catch blocks
- [x] No regression in save/persistence behavior
- [x] No regression in dark mode sync behavior

## Technical Notes

**Affected files:**

- `src/renderer/src/pages/editor.tsx:23-25` - Global mutable state
- `src/renderer/src/pages/editor.tsx:179-203` - SneakyFileUpdater
- `src/renderer/src/pages/editor.tsx:205-249` - SneakyDarkModeSync
- `src/renderer/src/pages/editor.tsx:137-164` - handleMount with cleanup issues

**Current problems:**

1. Lines 23-25: `lastModified` and `_dirty` are module-level variables shared across instances
2. Line 144-146: Empty catch block silently swallows errors
3. Line 163: `handleMount` deps list `[initialFileData.content, id]` but uses `.filePath` and `.id`
4. Line 191: `editor` in effect but not in deps array (captured from hook)
5. Lines 219-236: Second useEffect has empty deps but captures `editor`
6. Lines 238-246: `useValue` call returns unused boolean

**Existing pattern to follow:**

`useDocumentSync.ts` shows the right pattern - a class (`LocalSyncClient`) that manages disposables, and a hook that creates/destroys it with proper cleanup.

## Related

- Related: #0005 (improve dirty tracking - could be addressed together)
- Related: #0006 (onChange persistence)

## Implementation Plan

### Phase 1: Create Hooks

**1. Create `src/renderer/src/hooks/useEditorPersistence.ts`**

```typescript
function useEditorPersistence(id: string): void
```

- Get editor from `useEditor()` hook
- Create refs: `lastModifiedRef = useRef(-1)`, `dirtyRef = useRef(false)`
- Set up `editor.store.listen()` with `{ scope: 'document', source: 'user' }` to set dirty flag
- Set up 1000ms interval polling that calls persist when dirty
- Move `persist()` logic into hook (or keep as module function with refs passed in)
- Proper cleanup: clear interval, unsubscribe from store

**2. Create `src/renderer/src/hooks/useEditorDarkModeSync.ts`**

```typescript
function useEditorDarkModeSync(): void
```

- Get editor from `useEditor()`
- Effect 1: Watch `userPreferencesAtom.theme` → update `editor.user.updateUserPreferences({ colorScheme })`
- Effect 2: Use tldraw's `react()` to watch editor dark mode → send `editor-user-preferences-change` IPC
- Remove the unused `useValue()` call (lines 238-246)
- Proper cleanup: unsubscribe from all watchers

### Phase 2: Update Component

**3. Update `TldrawEditorView` in `editor.tsx`**

Replace:

```tsx
<Tldraw store={store} components={components} onMount={handleMount}>
	<SneakyFileUpdater id={initialFileData.id} />
	<SneakyDarkModeSync />
</Tldraw>
```

With hooks called at component level (after editor is available via state):

```tsx
const [editor, setEditor] = useState<Editor | null>(null)
useEditorPersistence(editor, id)
useEditorDarkModeSync(editor)

// In render:
<Tldraw store={store} components={components} onMount={setEditor} />
```

**4. Fix `handleMount` callback**

- Fix dependency array: `[id, initialFileData]` (currently missing `.filePath` and `.id`)
- Add cleanup for `window.tldraw = undefined` on unmount
- Replace empty catch block with error logging

### Phase 3: Remove Global State

**5. Delete from `editor.tsx`:**

- Line 23: `let lastModified = -1`
- Line 24: `let _dirty = false`
- Lines 179-203: `SneakyFileUpdater` component
- Lines 205-249: `SneakyDarkModeSync` component

### Phase 4: Verify

**6. Run e2e tests:**

```bash
npm run e2e
```

Key behaviors to verify:

- Auto-save timing (1s delay after edit)
- Dark mode sync (both directions)
- Save/Save As request handling
- Multiple editors don't interfere with each other
- `window.tldraw` cleaned up on unmount

### Files Changed

**Create:**

- `src/renderer/src/hooks/useEditorPersistence.ts`
- `src/renderer/src/hooks/useEditorDarkModeSync.ts`

**Modify:**

- `src/renderer/src/pages/editor.tsx`

### Notes

- Follow the pattern in `useDocumentSync.ts` - class manages disposables, hook manages lifecycle
- The hooks need `editor` as a parameter (nullable) since they're called before Tldraw mounts
- Alternative: keep hooks inside Tldraw children but as proper hooks not null-rendering components

## Implementation Notes

**Completed:** 2026-01-03

The refactoring was completed with one notable deviation from the original plan:

**Architecture Change:** The original plan called for 1000ms dirty-polling in `useEditorPersistence`. Instead, the implementation uses patch-based sync via `useDocumentSync`, which handles real-time persistence more efficiently. The `useEditorPersistence` hook now only provides a `persist()` function for explicit save operations (Cmd+S).

**Files Created:**
- `src/renderer/src/hooks/useEditorPersistence.ts` - Handles explicit saves, exposes `window.tldraw.persist()`
- `src/renderer/src/hooks/useEditorDarkModeSync.ts` - Bidirectional dark mode sync between app and editor

**Key Changes in `editor.tsx`:**
- Removed `SneakyFileUpdater` and `SneakyDarkModeSync` components
- Added hook calls at component level: `useEditorPersistence(editor, id)`, `useEditorDarkModeSync(editor)`
- Added cleanup effect for `window.tldraw` on unmount (line 193-199)
- Changed empty catch to `console.error` (line 158)
