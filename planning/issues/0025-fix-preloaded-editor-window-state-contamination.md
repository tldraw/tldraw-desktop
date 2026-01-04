# Fix preloaded editor window state contamination

**Status:** `in-progress`
**Priority:** `medium`
**Type:** `bug`

## Description

When the preloaded editor window is reused for a new file, the Tldraw store state persists from previous sessions. This causes new windows to inherit shapes from the previous editor.

## Context

The application uses a preloaded editor window pattern for instant new file creation. A hidden window is pre-rendered at `/f/PRELOAD` with an empty Tldraw editor. When a user creates a new file, this window's URL is changed to `/f/{newId}` and it becomes the active editor.

The problem is that when the preloaded window transitions from `/f/PRELOAD` to `/f/{newId}`, the Tldraw store state is not fully reset. The `PreloadedTldrawEditorView` component creates a Tldraw instance that accumulates state, and this state can leak into the actual editor when the URL changes.

## Acceptance Criteria

- [ ] New editor windows created from the preloaded window start with zero shapes
- [ ] The test "should create a new file from editor app menu" passes consistently
- [ ] Creating multiple new files in sequence all start empty
- [ ] The preload window pattern continues to provide fast window creation

## Technical Notes

**Affected files:**

- `src/main/WindowManager.ts:159-167` - `getEditorWindow()` reuses preloaded window by changing URL
- `src/renderer/src/pages/editor.tsx:79-80` - Conditionally renders `PreloadedTldrawEditorView` or `TldrawEditorView`
- `src/renderer/src/pages/editor.tsx:91-99` - `PreloadedTldrawEditorView` component
- `src/renderer/src/hooks/useDocumentSync.ts:170-209` - Creates the Tldraw store

**Current behavior:**
When creating a new file from an existing editor (File > New), the new editor window sometimes shows shapes from the previous session. The test at `e2e/tests/app-menu.test.ts:14` fails because shape count is 1 instead of 0.

**Expected behavior:**
Every new editor window should start with a completely fresh, empty Tldraw store with zero shapes.

**Root cause analysis:**
In `WindowManager.ts`, `getEditorWindow()` (lines 159-167) reuses the preloaded window:

```typescript
async getEditorWindow(id: string) {
  if (!this.preloadedEditorWindow?.id) {
    await this.createPreloadedEditorWindow()
  }
  const editorWindow = this.preloadedEditorWindow!
  await this.windowReadyPromises[editorWindow.id]
  this.loadUrlInWindow(editorWindow, `/f/${id}`)
  return editorWindow
}
```

When `loadUrlInWindow` is called with a new URL, React Router triggers a re-render but the `editor.tsx` component may not fully unmount/remount. The `PreloadedTldrawEditorView` creates a Tldraw instance that could accumulate state.

## Related

- Related: #0021 (Refactor editor lifecycle hooks)

## Implementation Plan

### Recommended Solution: Add key prop tied to route ID

The simplest and most reliable fix is to force React to fully remount the Tldraw component when the route ID changes.

**Step 1: Modify `PreloadedTldrawEditorView` to accept a key**

In `src/renderer/src/pages/editor.tsx`, the `PreloadedTldrawEditorView` component at line 91-99 creates an empty Tldraw instance. The issue is that when navigating from `/f/PRELOAD` to `/f/{newId}`, React reuses the same component tree because the route pattern `/f/:id` is the same.

Modify the `Component` function (lines 13-84) to pass the `id` as a key to force remounting:

```typescript
if (id === 'PRELOAD' || !initialFileData) {
  return <PreloadedTldrawEditorView key={id} />
}

return <TldrawEditorView key={id} id={id} initialFileData={initialFileData} initialLastModified={lastModifiedRef.current} />
```

**Step 2: Ensure the store is properly cleaned up on unmount**

The `useDocumentSync` hook (line 194-198) already has cleanup logic:

```typescript
return () => {
	isClosed = true
	clientRef.current = null
	client.close()
}
```

Verify that `client.close()` properly disposes of the store. If needed, call `store.dispose()` explicitly.

**Step 3: Verify window.tldraw cleanup**

The current cleanup in `TldrawEditorView` (lines 154-160) sets `window.tldraw = undefined` on unmount. Ensure this runs before the new component mounts.

### Alternative Solutions (if key prop is insufficient)

**Alternative A: Full page reload**
Instead of URL navigation, trigger a full page reload when transitioning the preloaded window. This guarantees all state is reset but loses the preload performance benefit.

**Alternative B: IPC-based state reset**
Send an IPC event from main process to renderer before URL change:

1. Add `editor-reset` event type in `src/types.ts`
2. In `WindowManager.getEditorWindow()`, send reset event before `loadUrlInWindow()`
3. In `editor.tsx`, listen for reset and call `editor.store.clear()` or recreate the store

**Alternative C: Create new preloaded window instead of reusing**
Instead of reusing the preloaded window, always destroy it and create a fresh one:

1. In `getEditorWindow()`, close the preloaded window
2. Create a new window directly with the correct URL
3. Recreate a new preloaded window for next use

This loses the instant-open benefit but guarantees clean state.

### Testing

1. Run the failing test: `npm e2e -g "should create a new file from editor app menu"`
2. Verify shape count is 0 in new windows
3. Run full e2e suite to ensure no regressions
4. Test manually: create editor with shapes, create new file, verify new file is empty

## Implementation Notes

### Root Cause Deep Dive

The issue stems from React's component reconciliation. When navigating from `/f/PRELOAD` to `/f/newId`:

1. The route `/f/:id` matches both URLs
2. React Router rerenders the `Component` from `editor.tsx`
3. The `id` param changes from `"PRELOAD"` to `"newId"`
4. The conditional at line 79-80 switches from `PreloadedTldrawEditorView` to `TldrawEditorView`
5. However, Tldraw may maintain internal state via React context or the store singleton

The `PreloadedTldrawEditorView` creates a `<Tldraw>` component without a `store` prop (line 95), which means Tldraw creates its own internal store. This store might be cached or reused through React's component reconciliation if keys aren't properly set.

### Key Files

- `src/renderer/src/pages/editor.tsx` - Main fix location
- `src/renderer/src/hooks/useDocumentSync.ts` - Store creation, verify cleanup
- `src/main/WindowManager.ts` - Window reuse logic (no changes needed if React fix works)
