# Fix home window visibility race condition

**Status:** `closed`
**Priority:** `medium`
**Type:** `bug`

## Description

The home window shows/hides incorrectly when editor windows are opened and closed, causing timing-related test failures.

## Context

When multiple editor windows are closed in sequence, the home window may become visible prematurely (while editor windows are still open) or fail to appear when the last editor is closed. This is a race condition in the window cleanup logic that causes flaky E2E tests.

**Affected Tests:**

- `app-menu.test.ts:167` - "closing last editor should show home" (timeout waiting for home-window-show)
- `home.test.ts:45` - "should not show home while editor windows are still open" (home visible when it shouldn't be)

## Acceptance Criteria

- [x] Closing the last editor window reliably shows the home window
- [x] Closing one editor while others remain open does NOT show the home window
- [x] Closing multiple editors in rapid sequence behaves correctly
- [x] All affected E2E tests pass consistently
- [x] No regression in window lifecycle behavior

## Technical Notes

**Affected files:**

- `src/main/WindowManager.ts:369-381` - `handleClosed` callback in `setupEditorWindow`
- `src/main/WindowManager.ts:530-534` - `removeWindow` method

**Current behavior:**
The `handleClosed` callback in `setupEditorWindow` (lines 369-381):

```typescript
const handleClosed = () => {
	// Unregister from sync before removing the file data
	this.mainManager.sync.unregisterWindow(newFileData.id, windowId)

	if (!this.mainManager.isQuitting) {
		this.mainManager.store.openFiles.remove(newFileData.id)
		this.removeWindow(windowId)
		if (Object.keys(this.windows).length === 0) {
			this.showHomeWindow()
		}
		this.createPreloadedEditorWindow()
	}
}
```

Issues:

1. The window count check (`Object.keys(this.windows).length === 0`) may happen before all cleanup is complete across multiple simultaneous close events
2. `createPreloadedEditorWindow()` is called after the check, which could affect window state tracking
3. When multiple editors close in rapid sequence, there's no coordination between their `handleClosed` callbacks

**Expected behavior:**

- Home window should only show when ALL editor windows are closed
- The window count check should be atomic and account for any pending close operations

## Related

- Related: #0007 (enable skipped e2e tests - may be related to test flakiness)
- Related: #0022 (improve e2e test infrastructure)

## Implementation Plan

### Root Cause Analysis

The race condition occurs in the `handleClosed` callback (WindowManager.ts:369-381). When multiple editor windows close rapidly:

1. Each window's `handleClosed` fires independently
2. The check `Object.keys(this.windows).length === 0` can race with other windows' cleanup
3. `createPreloadedEditorWindow()` is called after the check, creating a new preloaded window that is NOT in `this.windows` - this is fine
4. The `showHomeWindow()` is async but not awaited, which could cause timing issues

**Key insight**: The `this.windows` object only tracks editor windows that are actually showing content (not the preloaded window, not the home window). The race happens when:

- Window A and Window B close nearly simultaneously
- Window A's `handleClosed` runs first, removes A from `this.windows`
- Before Window B's `handleClosed` completes removal, A checks `this.windows.length === 0`
- This check may see B still in `this.windows`, so home is not shown
- Then B's handler runs, removes B, but B's check sees `length === 0` and calls `showHomeWindow()` correctly
- OR the checks can interleave incorrectly

### Implementation Steps

1. **Add debouncing/queuing for window close handling** (Recommended approach)
   - File: `src/main/WindowManager.ts`
   - Add a method `scheduleHomeWindowCheck()` that debounces the check
   - Replace direct `showHomeWindow()` call with the debounced version
   - This ensures all rapid close events complete before checking

   ```typescript
   private homeWindowCheckTimeout: NodeJS.Timeout | null = null

   private scheduleHomeWindowCheck() {
       if (this.homeWindowCheckTimeout) {
           clearTimeout(this.homeWindowCheckTimeout)
       }
       this.homeWindowCheckTimeout = setTimeout(() => {
           this.homeWindowCheckTimeout = null
           if (Object.keys(this.windows).length === 0) {
               this.showHomeWindow()
           }
       }, 50) // Small delay to allow all close events to process
   }
   ```

2. **Update handleClosed callback** (WindowManager.ts:369-381)
   - Replace the direct check and `showHomeWindow()` call with `scheduleHomeWindowCheck()`

   ```typescript
   const handleClosed = () => {
   	this.mainManager.sync.unregisterWindow(newFileData.id, windowId)

   	if (!this.mainManager.isQuitting) {
   		this.mainManager.store.openFiles.remove(newFileData.id)
   		this.removeWindow(windowId)
   		this.scheduleHomeWindowCheck()
   		this.createPreloadedEditorWindow()
   	}
   }
   ```

3. **Cleanup in dispose method** (WindowManager.ts:24)
   - Clear any pending timeout when disposing

   ```typescript
   async dispose() {
       if (this.homeWindowCheckTimeout) {
           clearTimeout(this.homeWindowCheckTimeout)
           this.homeWindowCheckTimeout = null
       }
   }
   ```

4. **Testing**
   - Run the affected E2E tests multiple times to verify reliability:
     - `npm e2e -g "closing last editor should show home"`
     - `npm e2e -g "should not show home while editor windows are still open"`
   - Run full E2E suite: `npm e2e`

### Alternative Approaches Considered

1. **Synchronous window tracking with Set** - Could use a Set with a flag for pending closes, but adds complexity
2. **Queue-based approach** - Process close events through a queue, but debouncing is simpler and sufficient
3. **Mutex/lock** - Overkill for this use case since we're in a single-threaded environment

### Edge Cases to Test

- Closing 2 editors rapidly (within 10ms)
- Closing 3+ editors in sequence
- Closing last editor when home is already visible (should not duplicate show)
- Creating new editor immediately after closing last one

## Implementation Notes

- The 50ms debounce delay is a balance between responsiveness and reliability
- The `showingHomeWindow` flag in `showHomeWindow()` already prevents duplicate shows
- The preloaded editor window is intentionally NOT tracked in `this.windows` - this is correct behavior
- Tests use polling with `expect.poll()` which should handle the slight delay gracefully
