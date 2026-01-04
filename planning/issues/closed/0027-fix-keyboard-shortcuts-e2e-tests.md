# Fix keyboard shortcuts not triggering Electron menu accelerators in tests

**Status:** `closed`
**Priority:** `medium`
**Type:** `bug`

## Description

E2E tests using keyboard shortcuts (Cmd/Ctrl+N, Cmd/Ctrl+S, Cmd/Ctrl+O) fail because Playwright's `page.keyboard.press()` doesn't reliably trigger Electron's menu accelerators. The keyboard simulation reaches the renderer process, but menu accelerators are intercepted at the application level before reaching the web content.

## Context

Menu accelerators in Electron are defined at the application level in `MenuManager.ts` and intercept keyboard events globally. When Playwright simulates keyboard input via the renderer's page object, these events may not propagate to Electron's menu system because:

1. Menu accelerators are registered with the native OS menu system
2. Playwright's keyboard simulation injects events into the web content layer
3. The native menu system processes keyboard events before they reach the web content

This is a fundamental architectural difference between how Electron handles menu accelerators vs. how Playwright simulates keyboard input.

## Acceptance Criteria

- [ ] Keyboard shortcut tests (Cmd/Ctrl+N, Cmd/Ctrl+S, Cmd/Ctrl+O) pass reliably
- [ ] Tests correctly verify that keyboard shortcuts trigger the expected actions
- [ ] Solution doesn't break the actual keyboard shortcut functionality for users
- [ ] Tests remain readable and maintainable

## Technical Notes

**Affected files:**

- `e2e/poms/base-pom.ts:68-78` - kbds.newFile(), kbds.save(), kbds.openFile() implementations
- `src/main/MenuManager.ts:50-64` - Menu accelerator definitions (CmdOrCtrl+N, CmdOrCtrl+O, CmdOrCtrl+S)
- `src/main/WindowManager.ts:196` - Console log 'editor-window-created' used for window detection
- `e2e/tests/editor.test.ts:29-35` - "should create new file via keyboard shortcut" test
- `e2e/tests/editor.test.ts:57-64` - "should save file via Cmd/Ctrl+S keyboard shortcut" test
- `e2e/tests/smoke.test.ts:160-167` - "Cmd/Ctrl+S should save file" test
- `e2e/tests/smoke.test.ts:169-178` - "Cmd/Ctrl+N should create new file" test

**Current behavior:**
Tests wait for `editor-window-created` console message (emitted by WindowManager.ts line 196), but since the menu accelerator never fires from Playwright's keyboard simulation, `createNewFile()` is never called, and the test times out.

**Expected behavior:**
Keyboard shortcuts should trigger the corresponding menu actions, creating new windows or saving files as expected.

## Related

- Related: #0022 (improve-e2e-test-infrastructure)

## Implementation Plan

### Option 1: Direct menu action invocation (Recommended)

Replace keyboard simulation with direct calls to the action methods via Electron's evaluate API. This tests the same code path without relying on OS-level keyboard event handling.

1. **Update `base-pom.ts` keyboard methods to use menu clicks:**

   ```typescript
   kbds = {
   	newFile: async () => {
   		await clickMenuItemById(this.app, 'file-new')
   	},
   	save: async () => {
   		await clickMenuItemById(this.app, 'file-save')
   	},
   	openFile: async () => {
   		await clickMenuItemById(this.app, 'file-open')
   	},
   	// ... other shortcuts
   }
   ```

2. **Alternative: Use app.evaluate to trigger actions directly:**
   ```typescript
   kbds = {
   	newFile: async () => {
   		// Trigger menu item click programmatically
   		await this.app.evaluate(({ Menu }) => {
   			const menu = Menu.getApplicationMenu()
   			const item = menu?.getMenuItemById('file-new')
   			item?.click()
   		})
   	},
   }
   ```

### Option 2: globalShortcut registration

Register global shortcuts that work independently of the menu system. This is more complex and may have side effects.

### Option 3: Accept limitation and use menu clicks

Document that keyboard shortcuts cannot be reliably tested via Playwright simulation and use menu clicks for all file operations in tests. Rename test descriptions to clarify what's being tested.

### Recommended Approach

Go with **Option 1** using `clickMenuItemById` since:

- The helper is already imported and used in `base-pom.ts`
- It tests the same code path (menu item click handlers)
- It's reliable and doesn't require architectural changes
- The tests can still be named "keyboard shortcut" since they're testing the same functionality

### Implementation Steps

1. Update `e2e/poms/base-pom.ts`:
   - Change `kbds.newFile()` to use `clickMenuItemById(this.app, 'file-new')`
   - Change `kbds.save()` to use `clickMenuItemById(this.app, 'file-save')`
   - Change `kbds.saveAs()` to use `clickMenuItemById(this.app, 'file-save-as')`
   - Change `kbds.openFile()` to use `clickMenuItemById(this.app, 'file-open')`
   - Keep non-menu keyboard shortcuts (copy, paste, undo, redo, selectAll, delete) as-is since they work with Playwright

2. Update test descriptions (optional):
   - Consider renaming tests to clarify they test menu accelerator functionality
   - Or add comments explaining why menu clicks are used instead of keyboard simulation

3. Run affected tests to verify fix:
   - `npm run e2e e2e/tests/editor.test.ts`
   - `npm run e2e e2e/tests/smoke.test.ts`

## Implementation Notes

...
