# Fix async save state assertions in E2E tests

**Status:** `open`
**Priority:** `medium`
**Type:** `bug`

## Description

Multiple E2E tests fail because they check the window title immediately after save operations without waiting for async IPC events to propagate. The `expectTitleToContain()` method in `base-pom.ts` does not properly wait for asynchronous state updates that occur after file operations.

## Context

The save flow in the application is fully asynchronous:

1. Keyboard shortcut or menu action triggers save request
2. Main process writes file and sends `file-path-change` event via IPC
3. Renderer receives event and updates `filePathAtom` and `unsavedChangesAtom`
4. Title component re-renders with new filename

Tests use immediate assertions like `await editor.expectTitleToContain(/test-/)` but the IPC events haven't arrived yet. The title shows "Untitled" (possibly with dirty indicator) instead of the expected filename because the renderer hasn't received the state update yet.

**Affected Tests:**

- `app-menu.test.ts:50` - "should save a new file from app menu"
- `app-menu.test.ts:99` - "should save as new file from app menu"
- `editor.test.ts:43` - "should open a saved file via File > Open menu"
- `editor.test.ts:63` - "should save file via Cmd/Ctrl+S keyboard shortcut"
- `editor.test.ts:93` - "should open file via Cmd/Ctrl+O keyboard shortcut"
- `editor.test.ts:114` - "should save as via Cmd/Ctrl+Shift+S keyboard shortcut"
- `smoke.test.ts:40` - "full file lifecycle: create, edit, save, close, reopen"
- `smoke.test.ts:166` - "Cmd/Ctrl+S should save file"
- `smoke.test.ts:185` - "Cmd/Ctrl+O should open file dialog"

## Acceptance Criteria

- [ ] `expectTitleToContain()` properly waits for async state updates
- [ ] All affected tests pass consistently without timing-related flakiness
- [ ] No unnecessary delays introduced (only wait as long as needed)
- [ ] Fix is applied in a centralized location (base-pom.ts) rather than in each test

## Technical Notes

**Affected files:**

- `e2e/poms/base-pom.ts:133-135` - Current `expectTitleToContain()` implementation uses immediate assertion
- `e2e/tests/app-menu.test.ts` - Multiple tests use `expectTitleToContain()` after save
- `e2e/tests/editor.test.ts` - Multiple tests use `expectTitleToContain()` after save
- `e2e/tests/smoke.test.ts` - Multiple tests use `expectTitleToContain()` after save

**Current behavior:**

The `expectTitleToContain()` method directly asserts on the title element without waiting:

```typescript
async expectTitleToContain(text: string | RegExp) {
    await expect(this.page.getByTestId('editor__titlebar__title')).toContainText(text)
}
```

This fails because Playwright's `toContainText()` has a default timeout but still expects the condition to be met relatively quickly. If the async IPC event chain takes longer, the test fails.

**Expected behavior:**

The method should use a polling mechanism or explicit wait to handle async state updates, similar to how other tests in the codebase already handle this:

```typescript
// Example from editor.test.ts:79-84
await expect
	.poll(
		async () => {
			const title = await titleElement.textContent()
			return title !== initialTitle || title?.includes('*') || title?.includes('Edited')
		},
		{ timeout: 5000, message: 'Title should indicate unsaved changes' }
	)
	.toBe(true)
```

## Related

- Related: #0022 (Improve E2E test infrastructure)

## Implementation Plan

### Root Cause Analysis

The async flow for file save operations:

1. **User triggers save** via keyboard shortcut (`Cmd/Ctrl+S`) or app menu
2. **Main process handles save** in `ActionManager.ts`:
   - Lines 249-252: Sends `file-path-change` IPC event to renderer
   - Line 254: Writes the file to disk
3. **Renderer receives event** in `editor.tsx`:
   - Line 65-69: Handles `file-path-change` event and updates `filePathAtom`
4. **Title re-renders** in `EditorTitleBar.tsx`:
   - Lines 6-7: Uses `useValue` to react to `filePathAtom` changes
   - Lines 13-19: Renders filename or "Untitled" based on `filePath`

The problem is that the test assertions execute synchronously after the save action, but the IPC event delivery and React re-render are asynchronous.

### Fix Approach

Update `expectTitleToContain()` in `base-pom.ts` to use Playwright's `toContainText()` with an explicit timeout, or use `expect.poll()` for more control.

**Option A (Recommended): Use `toContainText()` with timeout**

Playwright's `toContainText()` already has retry behavior, but we need to ensure adequate timeout for IPC propagation:

```typescript
async expectTitleToContain(text: string | RegExp, timeout = 5000) {
    await expect(this.page.getByTestId('editor__titlebar__title'))
        .toContainText(text, { timeout })
}
```

**Option B: Use `expect.poll()` for explicit polling**

```typescript
async expectTitleToContain(text: string | RegExp, timeout = 5000) {
    const titleElement = this.page.getByTestId('editor__titlebar__title')
    await expect.poll(
        async () => {
            const content = await titleElement.textContent()
            if (typeof text === 'string') {
                return content?.includes(text)
            }
            return text.test(content ?? '')
        },
        { timeout, message: `Title should contain "${text}"` }
    ).toBe(true)
}
```

### Implementation Steps

1. **Update `e2e/poms/base-pom.ts`:**
   - Modify `expectTitleToContain()` method (lines 133-135)
   - Add explicit timeout parameter with default of 5000ms
   - Ensure Playwright's auto-retry is leveraged properly

2. **Verify all affected tests pass:**
   - `npm run e2e e2e/tests/app-menu.test.ts`
   - `npm run e2e e2e/tests/editor.test.ts`
   - `npm run e2e e2e/tests/smoke.test.ts`

3. **Run full test suite to check for regressions:**
   - `npm run e2e`

### Testing Considerations

- The default timeout of 5000ms should be sufficient for IPC + React re-render
- Tests should not be artificially slowed if the state updates quickly (Playwright will proceed as soon as condition is met)
- Consider adding a small buffer for CI environments which may be slower

### Files to Modify

| File                   | Change                                                |
| ---------------------- | ----------------------------------------------------- |
| `e2e/poms/base-pom.ts` | Update `expectTitleToContain()` to handle async state |

### Risks

- **Low risk**: This is a test-only change that does not affect production code
- **Potential false positives**: If timeout is too short, tests may still be flaky on slow CI
- **Recommendation**: Start with 5000ms timeout and adjust if needed

## Implementation Notes

...
