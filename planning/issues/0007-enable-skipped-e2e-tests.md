# Enable Skipped E2E Tests

**Status:** `open`
**Priority:** `medium`
**Type:** `enhancement`

## Description

Three E2E tests in `home.test.ts` are currently skipped and need to be implemented/fixed.

## Context

Complete test coverage ensures app stability and catches regressions. These tests cover important user flows.

## Acceptance Criteria

- [ ] "should not re-open home window if home window is already open" passes
- [ ] "should be able to open a file" passes
- [ ] "if a file has been recently opened, it should be in the recent files list" passes
- [ ] All tests run in CI without flakiness

## Technical Notes

**Affected files:**

- `e2e/home.test.ts:138` - Home window re-open test
- `e2e/home.test.ts:141` - Open file test
- `e2e/home.test.ts:145` - Recent files test

**Investigation needed:**

1. Determine why tests were skipped (flaky? not implemented? blocked?)
2. Review test implementation
3. Fix underlying issues or complete test implementation
4. Verify stability across multiple runs

## Related

- None

## Implementation Plan

...

## Implementation Notes

...
