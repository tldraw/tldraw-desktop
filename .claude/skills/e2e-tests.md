---
name: e2e-tests
description: Provides guidance for writing fast, reliable, and maintainable e2e tests for this Electron application. Use when writing, reviewing, or improving e2e tests.
---

## Quick Reference

```bash
# Run all e2e tests
npm run e2e

# Run a single test file
npm run e2e e2e/tests/editor.test.ts

# Run a specific test by name
npm run e2e -g "should open to an empty project"

# Run with Playwright UI for debugging
npm run e2e:ui

# Run tests multiple times to check for flakiness
npm run e2e -- --repeat-each 3
```

## Infrastructure

### electron-playwright-helpers

The test suite uses [electron-playwright-helpers](https://github.com/spaceagetv/electron-playwright-helpers) for:

- **`clickMenuItemById()`** - Simplified menu item clicks (used in BasePOM)
- **`stubDialog()`** - Mock native file dialogs for testing

### Playwright Config

Key settings in `playwright.config.ts`:

- **Trace capture**: `on-first-retry` - Records traces only when tests are retried
- **Video recording**: `on-first-retry` - Records video only when tests are retried
- **Screenshots**: `only-on-failure` - Captures screenshots on test failures
- **Retries**: 1 retry in CI, 0 locally for fast feedback
- **HTML Report**: Generated in CI at `.playwright-results/html-report/`

### CI Integration

E2E tests run on GitHub Actions (`.github/workflows/e2e.yml`):

- Runs on push/PR to main branch
- Tests on Linux, macOS, and Windows
- Uses `xvfb-run` on Linux for headless display
- Uploads artifacts (traces, videos, screenshots) on failure

## Architecture Overview

### Test Setup (`e2e/setup-test.ts`)

Each test file uses `setupTestFile()` which provides:

- **`app`**: The `ElectronApplication` instance
- **`homeWindow`**: The initial `Page` (home window)
- **`homePom`**: A ready-to-use `HomePOM` instance

Each test gets a fresh app instance with an isolated data directory that's cleaned up afterward.

### Page Object Models (POMs)

POMs encapsulate page interactions and provide type-safe methods:

- **`BasePOM`**: Shared functionality (app menu, keyboard shortcuts, window bounds)
- **`HomePOM`**: Home screen interactions
- **`EditorPOM`**: Editor canvas and menu interactions
- **`LicensePOM`**, **`AboutPOM`**: Info page interactions

### Window Transition Pattern

Use the static `After` method to wait for new windows:

```typescript
// Wait for editor window after clicking "New File"
const editor = await EditorPOM.After(app, () => homePom.newFile())

// Wait for home window after closing editor
const home = await HomePOM.After(app, () => editor.close())
```

This pattern listens for console messages (`editor-window-created`, `home-window-show`) to detect when windows are ready.

## Best Practices

### 1. Don't Test Content or Copy

E2E tests should verify **functionality**, not **content**. Avoid assertions on:

- Text copy, prose, or labels (e.g., "Welcome to tldraw", "Getting Started")
- The existence of paragraphs, headings, or descriptive text
- Links within paragraphs or content sections
- "Structure" that is really just content existence checks

**What to test instead:**

- Interactive UI elements (buttons, inputs, menus)
- Functional behavior (clicking a button does X)
- Navigation and routing
- Data persistence and state changes

```typescript
// BAD: Testing content existence
await expect(page.getByText('Welcome to tldraw desktop')).toBeVisible()
await expect(page.getByText('Learn more about')).toBeVisible()
await expect(page.locator('a[href*="docs"]')).toBeVisible() // link in prose

// GOOD: Testing functional UI
await expect(page.getByRole('button', { name: 'New File' })).toBeVisible()
await expect(page.getByRole('menuitem', { name: 'Save' })).toBeEnabled()
```

Content can change frequently and isn't the responsibility of e2e tests—that's what manual review and design QA are for.

### 2. Combine Related Functionality Into Single Tests

**Bad**: Many small tests that each start from scratch

```typescript
// Each test launches app, creates file, wastes time
test('can draw rectangle', async ({ app, homePom }) => { ... })
test('can draw circle', async ({ app, homePom }) => { ... })
test('can draw triangle', async ({ app, homePom }) => { ... })
```

**Good**: One test that exercises a logical flow

```typescript
test('editor supports basic shape operations', async ({ app, homePom }) => {
	const editor = await EditorPOM.After(app, () => homePom.newFile())

	// Test drawing multiple shapes in sequence
	await editor.drawRectangle(100, 100, 100, 100)
	expect(await editor.getShapeCount()).toBe(1)

	await editor.drawRectangle(250, 100, 100, 100)
	expect(await editor.getShapeCount()).toBe(2)

	// Test selection, deletion, etc. in the same test
	// This tests a real user workflow, not isolated operations
})
```

### 3. Avoid Native System Dialogs

Native dialogs (file picker, confirm dialogs) block test execution and are unreliable. Use these strategies:

#### Use Programmatic APIs Instead of Dialogs

The app provides test-friendly alternatives:

```typescript
// BAD: Opens native file picker (blocks tests)
await editor.kbds.openFile() // Ctrl+O triggers native dialog

// GOOD: Use menu API that bypasses native dialog in test mode
await editor.appMenu.file.open() // Uses pre-configured test file
```

#### Use `app.evaluate()` for Electron APIs

Access Electron APIs directly to avoid dialogs:

```typescript
// Programmatically trigger menu items
await this.app.evaluate(async ({ Menu }) => {
	const item = Menu.getApplicationMenu()?.getMenuItemById('file-save')
	item?.click()
})

// Access clipboard without system permissions dialog
await this.app.evaluate(({ clipboard }) => clipboard.writeText('test'))
```

#### Stub Native Dialogs

Use the dialog stubbing helpers in `e2e/helpers.ts` for tests that need to interact with native file dialogs:

```typescript
import { stubOpenDialog, stubSaveDialog, stubMessageBox } from 'e2e/helpers'

// Stub open dialog to return specific files
await stubOpenDialog(app, ['/path/to/file.tldr'])
await editor.appMenu.file.open()

// Stub save dialog to save to specific path
await stubSaveDialog(app, '/path/to/new-file.tldr')
await editor.appMenu.file.saveAs()

// Stub message box (confirmation dialogs)
await stubMessageBox(app, 0) // 0 = first button (e.g., "OK")
```

**Important**: Call stub functions BEFORE the action that triggers the dialog.

#### Configure Test Mode in the App

The app runs with `--playwright` flag. Use this to:

- Auto-save to test directory instead of showing save dialog
- Skip confirmation dialogs
- Use predictable file paths

### 4. Use Isolated Test Data Directories

Each test file gets its own data directory:

```typescript
const testDataDir = join(TEST_DATA_DIR, id)
await mkdir(testDataDir, { recursive: true })

app = await _electron.launch({
	args: ['./out/main/index.js', '--playwright'],
	env: { TEST_DATA_DIR: testDataDir },
})
```

This prevents tests from polluting each other's state.

### 5. Wait for Readiness, Not Time

**Bad**: Arbitrary sleeps

```typescript
await sleep(2000) // Hope it's ready?
```

**Good**: Wait for specific conditions

```typescript
// Wait for element
await this.page.waitForSelector('.tl-canvas', { state: 'visible' })

// Wait for console message indicating readiness
await new Promise((resolve) => {
	app.on('console', (msg) => {
		if (msg.text().includes('editor-window-created')) resolve(true)
	})
})

// Use Playwright's built-in waiting
await expect(this.page.locator('.tla-theme__dark')).toBeVisible()
```

Use short sleeps (100-200ms) only for debouncing when necessary:

```typescript
// After keyboard shortcuts, small delay for event propagation
await this.page.keyboard.press('Meta+C')
await sleep(100)
```

### 6. Use `app.evaluate()` for Canvas Operations

Don't try to simulate mouse interactions for complex canvas operations:

```typescript
// BAD: Fragile mouse simulation
await page.mouse.move(100, 100)
await page.mouse.down()
await page.mouse.move(200, 200)
await page.mouse.up()

// GOOD: Use the editor API directly
await this.page.evaluate(
	({ x, y, width, height }) => {
		const editor = (window as any).tldraw?.editor
		editor.createShape({
			type: 'geo',
			x,
			y,
			props: { w: width, h: height, geo: 'rectangle' },
		})
	},
	{ x: 100, y: 100, width: 100, height: 100 }
)
```

### 7. Handle Multiple Windows Correctly

Track windows carefully when tests involve multiple windows:

```typescript
test('multi-window workflow', async ({ app, homePom }) => {
	// Create first editor
	const editor1 = await EditorPOM.After(app, () => homePom.newFile())

	// Create second editor from first
	const editor2 = await EditorPOM.After(app, () => editor1.menu.new())

	// Verify window count
	expect(app.windows().length).toBe(3) // home + editor1 + editor2

	// Close in correct order if needed
	await editor2.close()
	await editor1.close()
})
```

### 8. Clean Assertions

Assert specific conditions, not broad state:

```typescript
// BAD: Vague assertion
expect(await editor.getShapeCount()).toBeGreaterThan(0)

// GOOD: Specific expected value
expect(await editor.getShapeCount()).toBe(2)

// GOOD: Use Playwright's auto-waiting assertions
await expect(editor.page.locator('.tl-canvas')).toBeVisible()
await editor.expectTitleToContain('test-')
```

## Writing New Tests

### Step 1: Choose the Right Test File

- `editor.test.ts` - Editor functionality, canvas operations
- `home.test.ts` - Home screen, recent files
- `app-menu.test.ts` - Native menu operations
- `sync.test.ts` - Data persistence, sync behavior
- Create new file for distinct feature areas

### Step 2: Set Up Test File

```typescript
import { EditorPOM } from 'e2e/poms/editor-pom'
import { HomePOM } from 'e2e/poms/home-pom'
import { setupTestFile } from 'e2e/setup-test'

const { test, expect } = setupTestFile()

test('descriptive test name', async ({ app, homePom }) => {
	// Test implementation
})
```

### Step 3: Add POM Methods for New Functionality

If testing new features, add methods to the appropriate POM:

```typescript
// In editor-pom.ts
export class EditorPOM extends BasePOM {
	async selectAllShapes() {
		await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
	}

	async deleteSelected() {
		await this.page.keyboard.press('Backspace')
		await sleep(100)
	}
}
```

### Step 4: Write the Test

Follow this pattern:

```typescript
test('feature description', async ({ app, homePom }) => {
	// 1. Navigate to starting state
	const editor = await EditorPOM.After(app, () => homePom.newFile())

	// 2. Perform actions
	await editor.drawRectangle(100, 100, 100, 100)

	// 3. Assert results
	expect(await editor.getShapeCount()).toBe(1)

	// 4. Test additional related scenarios in same test
	await editor.menu.save()
	await editor.expectTitleToContain('test-')
})
```

## Common Patterns

### Testing Theme Changes

```typescript
// Verify initial state
await expect(home.page.locator('.tla-theme__light')).toBeVisible()

// Change theme
await home.appMenu.file.preferences.theme()

// Verify change
await expect(home.page.locator('.tla-theme__dark')).toBeVisible()
```

### Testing File Operations

```typescript
// Save a file
await editor.menu.save()
await sleep(500) // Wait for save to complete

// Verify title changed from "Untitled" to saved name
await editor.expectTitleToContain('test-')
```

### Testing Window Bounds Persistence

```typescript
// Set bounds
await editor.setWindowBounds({ x: 100, y: 100, width: 800, height: 600 })
await sleep(500) // Wait for persistence

// Get actual bounds (may differ due to OS)
const savedBounds = await editor.getWindowBounds()

// Close and reopen
await editor.close()
// ... reopen file ...

// Verify restoration
const restoredBounds = await editor2.getWindowBounds()
expect(restoredBounds.x).toBe(savedBounds.x)
```

### Testing Data Persistence

```typescript
// Create data
await editor.drawRectangle(100, 100, 200, 150)
expect(await editor.getShapeCount()).toBe(1)

// Save and close
await editor.menu.save()
await editor.close()

// Reopen
const editor2 = await EditorPOM.After(app, () => home.openRecentFile(/test-/))

// Verify data persisted
expect(await editor2.getShapeCount()).toBe(1)
```

## Debugging Tips

1. **Use Playwright UI**: `npm run e2e:ui` for step-through debugging
2. **Check console output**: App logs go to test console via `app.on('console', ...)`
3. **Increase timeout**: Add `test.setTimeout(60000)` for long-running tests
4. **Screenshots**: Automatically captured on failure (check `.playwright-results/`)
5. **Trace viewer**: Run with `--retries 1` locally to generate traces on retry, then open with `npx playwright show-trace <trace.zip>`
6. **Video recording**: Traces on retry include video; check `.playwright-results/` after failures
7. **Check for flakiness**: Run `npm run e2e -- --repeat-each 3` to catch intermittent failures

## Checklist for New Tests

- [ ] Test verifies functionality, not content/copy (no prose or label assertions)
- [ ] Test combines related operations (not one assertion per test)
- [ ] No native system dialogs (uses programmatic APIs)
- [ ] Uses `waitFor*` or Playwright assertions instead of arbitrary sleeps
- [ ] Uses POM methods for interactions
- [ ] Uses `After` pattern for window transitions
- [ ] Assertions are specific and meaningful
- [ ] Test cleans up after itself (automatic via fixture)
- [ ] Run test in isolation: `npm run e2e -g "test name"`
- [ ] Run full suite to check for conflicts: `npm run e2e`
