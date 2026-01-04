# Improve E2E Test Infrastructure

**Status:** `closed`
**Priority:** `medium`
**Type:** `enhancement`

## Description

Enhance the existing e2e test infrastructure with additional tooling, better dialog handling, and CI improvements based on latest Electron + Playwright best practices.

## Context

Research into current (2025) guidance for Electron e2e testing reveals several opportunities to improve our test suite. The current setup follows good patterns (POMs, fixtures, sequential execution), but could benefit from additional tooling for dialog mocking, retry utilities for Electron-specific flakiness, and better CI debugging capabilities.

## Acceptance Criteria

- [x] Add `electron-playwright-helpers` package for dialog stubbing and utilities
- [x] Implement dialog mocking for file open/save tests
- [x] Add video recording for failed tests in CI
- [x] Configure trace capture on first retry
- [x] Document testing patterns in CLAUDE.md or separate doc

## Technical Notes

### Add electron-playwright-helpers

```bash
npm i -D electron-playwright-helpers
```

Key utilities to use:

- `stubDialog()` - Mock native file dialogs
- `clickMenuItemById()` - Simplify menu interactions (currently done manually in BasePOM)
- `retry()` - Auto-retry on "context closed" errors (Electron 27+ known flakiness)

### Dialog Stubbing Example

```typescript
import { stubDialog } from 'electron-playwright-helpers'

// Before triggering save dialog
await stubDialog(app, 'showSaveDialog', {
	filePath: '/path/to/test-file.tldr',
})

// Before triggering open dialog
await stubDialog(app, 'showOpenDialog', {
	filePaths: ['/path/to/existing.tldr'],
})
```

### Playwright Config Improvements

```typescript
// playwright.config.ts
export default defineConfig({
	// ... existing config
	use: {
		trace: 'on-first-retry', // Capture trace on retry for debugging
		video: 'on-first-retry', // Record video on retry
	},
	retries: process.env.CI ? 1 : 0, // Single retry in CI
})
```

### CI Configuration (GitHub Actions)

```yaml
- name: Run E2E Tests
  run: xvfb-run --auto-servernum npm run e2e
  timeout-minutes: 10

- name: Upload test artifacts
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: |
      .playwright-results/
      test-videos/
    retention-days: 7
```

### Refactor Menu Interactions

Current `BasePOM.appMenu` methods could be simplified using `clickMenuItemById()`:

```typescript
// Before (current)
appMenu.file.new = () =>
	this.app.evaluate(async ({ Menu }) => {
		const item = Menu.getApplicationMenu()?.getMenuItemById('file-new')
		if (!item) throw new Error('File new menu item not found')
		return item.click()
	})

// After (with electron-playwright-helpers)
import { clickMenuItemById } from 'electron-playwright-helpers'
appMenu.file.new = () => clickMenuItemById(this.app, 'file-new')
```

## Affected Files

- `package.json` - Add electron-playwright-helpers dependency
- `playwright.config.ts` - Add trace/video config
- `e2e/setup-test.ts` - Potentially add retry utilities
- `e2e/poms/base-pom.ts` - Refactor menu helpers
- `e2e/tests/*.ts` - Add dialog stubbing where needed
- `.github/workflows/*.yml` - Add artifact upload (if CI exists)

## Reference Resources

- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
- [electron-playwright-helpers](https://github.com/spaceagetv/electron-playwright-helpers)
- [electron-playwright-example](https://github.com/spaceagetv/electron-playwright-example)
- [Playwright CI Guide](https://playwright.dev/docs/ci)
- [actualbudget Playwright PR](https://github.com/actualbudget/actual/pull/4674)

## Related

- #0007 - Enable Skipped E2E Tests

## Implementation Plan

1. Add `electron-playwright-helpers` package
2. Update playwright.config.ts with trace/video/retry settings
3. Refactor BasePOM menu helpers to use `clickMenuItemById()`
4. Add dialog stubbing to enable skipped tests requiring file dialogs
5. Set up CI artifact upload for test failures
6. Verify all tests pass locally with `--repeat-each 3`
