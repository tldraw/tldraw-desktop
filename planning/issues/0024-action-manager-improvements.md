# ActionManager Improvements

**Status:** `open`
**Priority:** `medium`
**Type:** `enhancement`

## Description

Address several code quality issues, potential bugs, and reliability concerns in `ActionManager.ts` identified during code review.

## Context

The ActionManager handles critical file operations (create, open, save, close). Several issues could lead to data loss, inconsistent state, or poor user experience.

## Acceptance Criteria

- [ ] Fix race condition in save operations (write to disk before updating store)
- [ ] Preserve parse error details when opening invalid files
- [ ] Fix mutable module-level `testId` state for test isolation
- [ ] Add explicit return after handling already-open file case
- [ ] Fix typo in comment ("acrtive" → "active")

## Technical Notes

### 1. Race condition in `onSaveResponse` (Critical)

**Lines 231-254, 268-286**

The store is updated to show "saved" state before the file is actually written to disk. If `fs.writeFile` fails, the UI will show saved but data is lost.

```typescript
// Current (problematic):
this.mainManager.store.updateOpenFileWithDirtyNotification(...) // marks as saved
await fs.writeFile(filePath, ...) // can fail after store updated

// Should be:
await fs.writeFile(filePath, ...) // write first
this.mainManager.store.updateOpenFileWithDirtyNotification(...) // then update store
```

Consider using atomic writes (write to temp file, then rename) for additional safety.

### 2. Lost parse error details (Line 97)

```typescript
if (!parseFileResult.ok) {
	throw new Error('Failed to parse file')
}
```

The actual error from `parseTldrawJsonFile` is discarded. Should include: `throw new Error(`Failed to parse file: ${parseFileResult.error}`)`.

### 3. Mutable module-level state (Line 9)

```typescript
let testId = 1
```

This counter persists across test runs, potentially causing flaky tests. Options:

- Export a reset function for test cleanup
- Use a different test file naming strategy
- Move to instance state if appropriate

### 4. Implicit fall-through (Lines 79-86)

When a file is already open, the code focuses the window but doesn't explicitly return. It works but is unclear:

```typescript
if (fileData) {
	// ... focus window ...
	return { success: true } // Add explicit return
} else {
	// ... open file ...
}
```

### 5. Minor: Typo (Line 148)

```typescript
// close the user's acrtive window
```

Should be "active".

## Related

- Related: #0005 (improve dirty tracking)
- Related: #0006 (fix on-change persistence)

## Implementation Plan

...

## Implementation Notes

...
