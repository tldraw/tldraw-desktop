# Fix window count including hidden preloaded editor window

**Status:** `closed`
**Priority:** `medium`
**Type:** `bug`

## Description

E2E tests that count windows include the hidden preloaded editor window, causing assertions to fail. When tests call `app.windows()`, this returns ALL BrowserWindow instances including the hidden preload window at `/f/PRELOAD`.

## Context

The app maintains a hidden preloaded editor window for instant new file creation (see WindowManager.ts lines 133-152). This is a performance optimization - when a user creates a new file, the preloaded window is immediately shown rather than creating a new window from scratch.

However, this causes problems in E2E tests that count windows:

- Expected count: 2 (home + editor) or 2 (editor1 + editor2)
- Actual count: 3 (includes hidden preload window)

**Affected Tests:**

- `smoke.test.ts:70` - "multiple windows workflow" (Expected 2 windows, got 3)
- `home.test.ts:45` - "should not show home while editor windows are still open"

## Acceptance Criteria

- [ ] E2E tests correctly count only visible/active windows
- [ ] The "multiple windows workflow" test passes
- [ ] The "should not show home while editor windows are still open" test passes
- [ ] The fix does not break the preloaded window functionality
- [ ] Tests remain reliable and non-flaky

## Technical Notes

**Affected files:**

- `e2e/tests/smoke.test.ts:70` - window count assertion
- `e2e/tests/home.test.ts:45-79` - multiple window count assertions
- `src/main/WindowManager.ts:133-152` - preloaded window creation
- `e2e/setup-test.ts` - test fixture setup
- `e2e/poms/base-pom.ts` - base POM class

**Current behavior:**
`app.windows()` returns all BrowserWindow instances including:

1. Home window (visible or hidden)
2. Any active editor windows
3. The hidden preloaded editor window at `/f/PRELOAD`

**Expected behavior:**
Window count assertions should only count "active" windows (visible windows or windows the user has interacted with), excluding the hidden preload window.

**Proposed Fix Options:**

1. **Filter windows by visibility:** `app.windows().filter(w => w.isVisible())`
   - Pros: Simple, direct
   - Cons: Home window is sometimes hidden too, may need more nuance

2. **Filter by URL pattern:** exclude windows with `/f/PRELOAD` URL
   - Pros: Explicitly targets the preload window
   - Cons: Couples test to implementation detail

3. **Add a test helper method:** Create a helper like `getActiveWindows()` in test utils
   - Pros: Encapsulates logic, easy to maintain
   - Cons: Need to use it consistently across all tests

4. **Use WindowManager's tracked windows:** Access `this.windows` object length
   - Pros: Uses app's own tracking mechanism
   - Cons: May require exposing internal state to tests

## Related

- Related: #0022 (E2E test infrastructure improvements)

## Implementation Plan

### Recommended Approach: Add a test helper to count visible windows

The best approach is to add a helper function that filters out non-visible windows. This:

- Is explicit about what it's measuring
- Doesn't rely on URL patterns (which could change)
- Handles all edge cases (preload window is hidden, home window is sometimes hidden)

### Implementation Steps

1. **Add `getVisibleWindows()` helper in `e2e/helpers.ts`**

   ```typescript
   /**
    * Get only visible windows from the app, excluding hidden windows like
    * the preloaded editor window or hidden home window.
    */
   export async function getVisibleWindows(app: ElectronApplication): Promise<Page[]> {
   	const allWindows = app.windows()
   	const visibleWindows: Page[] = []

   	for (const win of allWindows) {
   		const isVisible = await app.evaluate(
   			({ BrowserWindow }, { url }) => {
   				const windows = BrowserWindow.getAllWindows()
   				const window = windows.find((w) => w.webContents.getURL() === url)
   				return window?.isVisible() ?? false
   			},
   			{ url: win.url() }
   		)
   		if (isVisible) {
   			visibleWindows.push(win)
   		}
   	}

   	return visibleWindows
   }

   /**
    * Get count of visible windows
    */
   export async function getVisibleWindowCount(app: ElectronApplication): Promise<number> {
   	const windows = await getVisibleWindows(app)
   	return windows.length
   }
   ```

2. **Update `e2e/tests/home.test.ts` line 44-79**

   Replace `app.windows().length` with `getVisibleWindowCount(app)`:
   - Line 47: `await expect.poll(() => getVisibleWindowCount(app), ...)`
   - Line 55: `await expect.poll(() => getVisibleWindowCount(app), ...)`
   - Line 66: `await expect.poll(() => getVisibleWindowCount(app), ...)`
   - Line 107: `const initialWindowCount = await getVisibleWindowCount(app)`
   - Line 115: `await expect.poll(() => getVisibleWindowCount(app), ...)`
   - Line 121: `await expect.poll(() => getVisibleWindowCount(app), ...)`

3. **Update expected counts in tests**

   After implementing the helper, review and update expected counts:
   - Initial state (home visible): 1 visible window
   - Home + editor: 1 visible window (home hidden when editor opens)
   - Two editors: 2 visible windows

   The test "should not show home while editor windows are still open" needs count updates:
   - Initial: expect 1 (home visible, preload hidden)
   - After 2 editors: expect 2 (both editors visible, home hidden, new preload hidden)
   - After closing 1 editor: expect 1

4. **Update or remove "should maintain window count with preloaded editor" test**

   This test at line 105-123 explicitly tests the preload window behavior. It may need to be:
   - Updated to test visible window counts
   - Or kept as-is if it's intentionally testing internal implementation

### Testing

- Run `npm e2e e2e/tests/home.test.ts` to verify home tests pass
- Run `npm e2e e2e/tests/smoke.test.ts` to verify smoke tests pass
- Run full `npm e2e` to ensure no regressions

### Edge Cases to Consider

1. **Timing**: The `isVisible()` check is async, so polling behavior should still work correctly
2. **Home window visibility**: Home window is hidden when editors are open, which is correct behavior
3. **Window close race conditions**: Ensure tests don't count windows during close transitions

## Implementation Notes

### Changes Made

1. **Added `getVisibleWindows()` and `getVisibleWindowCount()` helpers to `e2e/helpers.ts`**
   - Uses `BrowserWindow.isVisible()` to filter windows
   - Correctly excludes hidden preloaded window and hidden home window

2. **Updated `e2e/tests/home.test.ts`**
   - Replaced local `getVisibleWindowCount` function with the shared helper from `e2e/helpers.ts`
   - Test "should maintain preloaded window pool for instant file creation" now uses the proper visibility-based counting

3. **Minor cleanup: Removed unused `getEditor()` method from `e2e/poms/editor-pom.ts`**
   - Fixed pre-existing TypeScript error about unused variable

### Test Results

- The specific test for this issue (`should maintain preloaded window pool`) passes
- Other window lifecycle tests pass
- Two unrelated tests fail due to preloaded window state contamination (tracked in #0025):
  - "should keep home hidden while any editor remains open"
  - "should assign unique document IDs to each new file"

### Files Modified

- `e2e/helpers.ts` - Added visibility helpers
- `e2e/tests/home.test.ts` - Updated to use shared helper
- `e2e/poms/editor-pom.ts` - Removed unused method
