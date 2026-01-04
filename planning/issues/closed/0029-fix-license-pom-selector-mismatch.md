# Fix license page POM selector mismatch

**Status:** `closed`
**Priority:** `medium`
**Type:** `bug`

## Description

The license page E2E tests fail because the LicensePOM class uses CSS selectors that don't match the actual DOM structure of the license page.

## Context

Two license page tests are failing due to selector mismatches:

- `license.test.ts:100` - "should have proper page structure" (container `.license` not found)
- `license.test.ts:106` - "should have a visible header" (header `.license__header` not found)

The POM was likely written based on an assumed structure that doesn't match the implemented page, which uses a shared `TitleBar` component and different CSS class naming.

## Acceptance Criteria

- [x] `getContainer()` returns a selector that matches the actual license page container
- [x] `getHeader()` returns a selector that matches the actual license page header
- [x] Both "should have proper page structure" and "should have a visible header" tests pass
- [x] All other existing license page tests continue to pass

## Technical Notes

**Affected files:**

- `e2e/poms/license-pom.ts:10-16` - POM locators with incorrect selectors
- `src/renderer/src/pages/license.tsx:5-6` - Actual page structure using `.license__layout` and `<TitleBar />`
- `src/renderer/src/components/Titlebar.tsx:32` - TitleBar component renders `.editor__titlebar`

**Current behavior:**

| POM Method       | POM Selector       | Result            |
| ---------------- | ------------------ | ----------------- |
| `getContainer()` | `.license`         | Element not found |
| `getHeader()`    | `.license__header` | Element not found |

**Expected behavior:**

| POM Method       | Correct Selector    | Element            |
| ---------------- | ------------------- | ------------------ |
| `getContainer()` | `.license__layout`  | Root container div |
| `getHeader()`    | `.editor__titlebar` | TitleBar component |

**Root Cause:**
The license page (`src/renderer/src/pages/license.tsx`) uses:

- `<div className="license__layout">` as the root container (not `.license`)
- `<TitleBar />` component which renders `.editor__titlebar` (not `.license__header`)

The `TitleBar` component is a shared component used across multiple pages (home, about, license, error) that renders with the class `.editor__titlebar`.

## Related

- Related: #0003 (License page implementation)
- Related: #0022 (E2E test infrastructure)

## Implementation Plan

1. **Update `getContainer()` in `e2e/poms/license-pom.ts`** (line 10-12)
   - Change selector from `.license` to `.license__layout`

   ```typescript
   getContainer() {
     return this.page.locator('.license__layout')
   }
   ```

2. **Update `getHeader()` in `e2e/poms/license-pom.ts`** (line 14-16)
   - Change selector from `.license__header` to `.editor__titlebar`

   ```typescript
   getHeader() {
     return this.page.locator('.editor__titlebar')
   }
   ```

3. **Run license tests to verify fixes**

   ```bash
   npm run e2e e2e/tests/license.test.ts
   ```

4. **Verify all license tests pass**, particularly:
   - "should have proper page structure" (line 96-101)
   - "should have a visible header" (line 103-107)

## Implementation Notes

This is a straightforward two-line fix. The selectors simply need to match the actual DOM structure. No changes to the license page itself are needed - only the POM needs to be updated to reflect the existing implementation.

Note: The `.editor__titlebar` class name is somewhat misleading since it's used on non-editor pages, but this is the current design of the shared `TitleBar` component. A future cleanup could rename this to a more generic class name, but that's outside the scope of this bug fix.

### Changes Made (2026-01-03)

**File modified:** `e2e/poms/license-pom.ts`

1. `getContainer()`: Changed selector from `.license` to `.license__layout`
2. `getHeader()`: Changed selector from `.license__header` to `.editor__titlebar`

**Verification:** All 14 license tests pass.
