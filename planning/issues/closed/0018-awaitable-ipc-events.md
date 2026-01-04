# Replace request/response events with awaitable events

**Status:** `closed`
**Priority:** `medium`
**Type:** `enhancement`

## Description

Refactor the IPC event system to use a promise-based pattern instead of separate request/response events. Currently, operations like saving files use a two-event pattern (`editor-save-request` from main, `editor-save-response` from renderer) which requires manual coordination and callback management. This should be replaced with an awaitable invoke pattern for cleaner async code.

## Context

The current IPC system uses a fire-and-forget pattern with separate request and response events:

1. Main sends `editor-save-request` to renderer
2. Renderer does the work and sends `editor-save-response` back
3. Main has to listen for the response and correlate it with the request

This pattern:

- Requires manual state management to track pending requests
- Makes error handling more complex
- Results in harder-to-follow code flow
- Doesn't leverage Electron's built-in `ipcMain.handle`/`ipcRenderer.invoke` for two-way communication

A promise-based pattern would allow:

```typescript
// Instead of this:
sendMainEventToRenderer(window, { type: 'editor-save-request', payload: { id } })
// ...elsewhere, listen for response...

// We could do this:
const result = await invokeRenderer(window, 'editor-save', { id })
```

## Acceptance Criteria

- [x] Create a new `invokeRenderer`/`handleMainInvoke` pattern for two-way IPC
- [x] Refactor `editor-save-request`/`editor-save-response` to use awaitable pattern
- [x] Refactor `editor-save-as-request`/`editor-save-as-response` to use awaitable pattern
- [x] Maintain type safety for request/response payloads
- [x] Preserve existing one-way event patterns for broadcasts (e.g., `open-files-change`)
- [x] Update affected code in ActionManager, EventManager, and renderer
- [x] All existing e2e tests pass

## Technical Notes

**Affected files:**

- `src/main/EventManager.ts` - Add invoke/handle methods for two-way communication
- `src/preload/api.ts` - Add handler registration for main process invocations
- `src/types.ts` - Add new types for invoke patterns (InvokeEvent, InvokeResponse)
- `src/main/ActionManager.ts` - Refactor save operations to use await pattern
- `src/renderer/src/pages/editor.tsx` - Register invoke handlers instead of event listeners

**Current behavior:**

Save flow uses two separate events:

1. `editor-save-request` (main → renderer) triggers save
2. `editor-save-response` (renderer → main) returns serialized data
3. Code must manually coordinate these via callbacks/listeners

**Implementation approach:**

Use Electron's `ipcRenderer.invoke`/`ipcMain.handle` for renderer-initiated calls (already in place), and create a reverse pattern using `webContents.send` with a response channel for main-initiated calls to renderer.

## Related

- Part of ongoing IPC system improvements

## Implementation Plan

### Overview

Electron's built-in `ipcMain.handle`/`ipcRenderer.invoke` pattern only works for renderer-to-main communication. For main-to-renderer invoke patterns, we need to implement a custom solution using a request ID + response channel.

### Step 1: Define New Types in `src/types.ts`

Add new type definitions for the invoke pattern:

```typescript
// Main process can invoke these on the renderer
export type MainInvoke =
	| {
			type: 'editor-save'
			payload: { id: string; closing?: boolean }
			response: { serializedTldrFileData: string; lastModified: number }
	  }
	| {
			type: 'editor-save-as'
			payload: { id: string }
			response: { serializedTldrFileData: string; lastModified: number }
	  }

// Helper types for type safety
export type MainInvokePayload<T extends MainInvoke['type']> = Extract<
	MainInvoke,
	{ type: T }
>['payload']

export type MainInvokeResponse<T extends MainInvoke['type']> = Extract<
	MainInvoke,
	{ type: T }
>['response']

// Update Api interface to include handler registration
export interface Api {
	// ... existing methods ...
	onMainInvoke<T extends MainInvoke['type']>(
		invokeName: T,
		handler: (payload: MainInvokePayload<T>) => Promise<MainInvokeResponse<T>>
	): () => void
}
```

Remove the old request/response event types:

- `editor-save-request` from MainEvent
- `editor-save-as-request` from MainEvent
- `editor-save-response` from RendererEvent
- `editor-save-as-response` from RendererEvent

### Step 2: Update Preload API (`src/preload/api.ts`)

Add invoke handler registration that:

1. Listens for `main-invoke` channel messages
2. Routes to registered handlers by invoke type
3. Sends response back on `main-invoke-response` channel

```typescript
// Track registered handlers
const mainInvokeHandlers: Map<string, (payload: any) => Promise<any>> = new Map()

export const api: Api = {
	// ... existing methods ...

	onMainInvoke(invokeName, handler) {
		mainInvokeHandlers.set(invokeName, handler)
		return () => mainInvokeHandlers.delete(invokeName)
	},
}

// Set up invoke listener once
ipcRenderer.on('main-invoke', async (_, { requestId, type, payload }) => {
	const handler = mainInvokeHandlers.get(type)
	if (handler) {
		try {
			const response = await handler(payload)
			ipcRenderer.send('main-invoke-response', { requestId, success: true, response })
		} catch (error) {
			ipcRenderer.send('main-invoke-response', { requestId, success: false, error: error.message })
		}
	}
})
```

### Step 3: Update EventManager (`src/main/EventManager.ts`)

Add the `invokeRenderer` method:

```typescript
private pendingInvokes = new Map<string, { resolve: Function; reject: Function }>()

async initialize() {
  // ... existing code ...
  ipcMain.on('main-invoke-response', this.handleInvokeResponse)
}

private handleInvokeResponse = (_: any, { requestId, success, response, error }: any) => {
  const pending = this.pendingInvokes.get(requestId)
  if (pending) {
    this.pendingInvokes.delete(requestId)
    if (success) {
      pending.resolve(response)
    } else {
      pending.reject(new Error(error))
    }
  }
}

invokeRenderer = async <T extends MainInvoke['type']>(
  window: BrowserWindow,
  type: T,
  payload: MainInvokePayload<T>
): Promise<MainInvokeResponse<T>> => {
  if (window.isDestroyed()) throw new Error('Window is destroyed')

  const requestId = crypto.randomUUID()

  return new Promise((resolve, reject) => {
    this.pendingInvokes.set(requestId, { resolve, reject })
    window.webContents.send('main-invoke', { requestId, type, payload })

    // Timeout after 30 seconds
    setTimeout(() => {
      if (this.pendingInvokes.has(requestId)) {
        this.pendingInvokes.delete(requestId)
        reject(new Error('Invoke timed out'))
      }
    }, 30000)
  })
}
```

### Step 4: Refactor ActionManager (`src/main/ActionManager.ts`)

Update save methods to use the awaitable pattern:

**Before (lines 176-190):**

```typescript
async onSaveRequest(info: { closing?: boolean } = {}): Promise<ActionResult> {
  // ... get openFileData and window ...
  this.mainManager.events.sendMainEventToRenderer(window, {
    type: 'editor-save-request',
    payload: { id: openFileData.id, closing: info.closing },
  })
  return { success: true }
}
```

**After:**

```typescript
async saveCurrentFile(info: { closing?: boolean } = {}): Promise<ActionResult> {
  const openFileData = this.mainManager.store.getActiveOpenFileData()
  if (!openFileData) return { success: true }

  const window = this.mainManager.windows.get(openFileData.window.id)
  if (!window) return { success: false, error: 'Window not found' }

  try {
    const { serializedTldrFileData, lastModified } = await this.mainManager.events.invokeRenderer(
      window,
      'editor-save',
      { id: openFileData.id, closing: info.closing }
    )

    // Handle the response inline (move onSaveResponse logic here)
    return await this.handleSaveResponse(openFileData.id, serializedTldrFileData, lastModified, info.closing)
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
```

Similarly refactor `saveAsCurrentFile` to use `invokeRenderer('editor-save-as', ...)`.

The `onSaveResponse` and `onSaveAsResponse` methods can be renamed to `handleSaveResponse` and `handleSaveAsResponse` as private helper methods.

### Step 5: Update Renderer (`src/renderer/src/pages/editor.tsx`)

Replace event listeners with invoke handlers:

**Before (lines 71-91):**

```typescript
window.api.onMainEvent('editor-save-request', async ({ id: _requestedId, closing }) => {
  if (id !== _requestedId) return
  persist(window.tldraw.editor, id)
  const serializedTldrFileData = await serializeTldrawJson(window.tldraw.editor)
  window.api.sendRendererEventToMain('editor-save-response', {
    id, serializedTldrFileData, closing, lastModified,
  })
}),
```

**After:**

```typescript
window.api.onMainInvoke('editor-save', async ({ id: requestedId, closing }) => {
  if (id !== requestedId) throw new Error('ID mismatch')
  persist(window.tldraw.editor, id)
  const serializedTldrFileData = await serializeTldrawJson(window.tldraw.editor)
  return { serializedTldrFileData, lastModified }
}),
```

### Step 6: Cleanup

1. Remove unused event types from `src/types.ts`:
   - `editor-save-request` from MainEvent
   - `editor-save-as-request` from MainEvent
   - `editor-save-response` from RendererEvent
   - `editor-save-as-response` from RendererEvent

2. Remove the `onSaveRequest`, `onSaveAsRequest`, `onSaveResponse`, `onSaveAsResponse` methods that were called from event handlers

3. Remove event handler registrations in MainManager that called these methods

### Step 7: Testing

1. Run `npm run typecheck` to verify type safety
2. Run `npm run e2e` to verify all e2e tests pass:
   - Save new file flow
   - Save existing file flow
   - Save As flow
   - Save on close flow

### Edge Cases to Consider

- **Window destroyed during invoke**: The `invokeRenderer` method should check if window is destroyed and reject immediately
- **Timeout handling**: Include a reasonable timeout (30s) for invokes that don't receive a response
- **Error propagation**: Errors in the renderer handler should be properly propagated back to the main process
- **Cleanup on dispose**: Clear pending invokes in EventManager.dispose()

### Files Changed Summary

| File                                | Changes                                             |
| ----------------------------------- | --------------------------------------------------- |
| `src/types.ts`                      | Add MainInvoke type, remove request/response events |
| `src/preload/api.ts`                | Add onMainInvoke method and invoke listener         |
| `src/main/EventManager.ts`          | Add invokeRenderer method and response handling     |
| `src/main/ActionManager.ts`         | Refactor save methods to use await pattern          |
| `src/renderer/src/pages/editor.tsx` | Use onMainInvoke instead of event listeners         |
| `src/main/MainManager.ts`           | Remove old event handler registrations              |

## Implementation Notes

Implementation completed successfully. The following changes were made:

### Key Changes

1. **New Types** (`src/types.ts`):
   - Added `MainInvoke` union type for awaitable main-to-renderer invocations
   - Added `MainInvokePayload<T>` and `MainInvokeResponse<T>` helper types for type safety
   - Added `onMainInvoke` method to `Api` interface
   - Removed `editor-save-request`, `editor-save-as-request` from `MainEvent`
   - Removed `editor-save-response`, `editor-save-as-response` from `RendererEvent`

2. **Preload API** (`src/preload/api.ts`):
   - Added `mainInvokeHandlers` Map to track registered handlers
   - Added `main-invoke` IPC listener that routes to handlers and sends responses
   - Implemented `onMainInvoke` method for handler registration

3. **EventManager** (`src/main/EventManager.ts`):
   - Added `pendingInvokes` Map to track in-flight invocations
   - Added `handleInvokeResponse` to process renderer responses
   - Implemented `invokeRenderer<T>` method with type-safe payload/response
   - Added 30-second timeout for pending invokes
   - Cleanup of pending invokes on dispose

4. **ActionManager** (`src/main/ActionManager.ts`):
   - Refactored `saveCurrentFile` to use `invokeRenderer('editor-save', ...)`
   - Refactored `saveAsCurrentFile` to use `invokeRenderer('editor-save-as', ...)`
   - Renamed `onSaveResponse`/`onSaveAsResponse` to `handleSaveResponse`/`handleSaveAsResponse` (private)
   - Removed `onSaveRequest`/`onSaveAsRequest` methods (no longer needed)

5. **Editor Component** (`src/renderer/src/pages/editor.tsx`):
   - Replaced `onMainEvent('editor-save-request', ...)` with `onMainInvoke('editor-save', ...)`
   - Replaced `onMainEvent('editor-save-as-request', ...)` with `onMainInvoke('editor-save-as', ...)`
   - Handlers now return response directly instead of sending separate event

6. **MainManager** (`src/main/MainManager.ts`):
   - Removed `editor-save-response` event handler registration
   - Removed `editor-save-as-response` event handler registration

### Testing Results

- All 19 save-related e2e tests pass
- All 11 smoke tests pass
- TypeScript compilation succeeds

### Benefits

- **Cleaner async flow**: Save operations are now simple `await` calls
- **Better error handling**: Errors propagate naturally through try/catch
- **Type safety**: Full type inference for request payloads and response types
- **Simplified code**: No need for separate request/response event coordination
- **Built-in timeout**: 30-second timeout prevents hanging operations
