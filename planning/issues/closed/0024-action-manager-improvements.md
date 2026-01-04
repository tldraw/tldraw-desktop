# ActionManager Improvements

**Status:** `closed`
**Priority:** `medium`
**Type:** `enhancement`

## Description

Address several code quality issues, potential bugs, and reliability concerns in `ActionManager.ts` identified during code review.

## Context

The ActionManager handles critical file operations (create, open, save, close). Several issues could lead to data loss, inconsistent state, or poor user experience.

## Acceptance Criteria

- [x] Fix race condition in save operations (write to disk before updating store)
- [x] Preserve parse error details when opening invalid files
- [x] Fix mutable module-level `testId` state for test isolation
- [x] Add explicit return after handling already-open file case
- [x] Fix typo in comment ("acrtive" → "active")

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

1. **Fix race condition in save operations** (Critical)
   - In `onSaveResponse`, move `fs.writeFile` to execute BEFORE updating the store
   - Do the same for the `onSaveAsResponse` method
   - This ensures the UI only shows "saved" state after the file is actually written

2. **Preserve parse error details**
   - In `openFile`, change `throw new Error('Failed to parse file')` to include the actual error message from `parseFileResult.error`

3. **Fix mutable testSaveId state**
   - Export a `resetTestSaveId()` function for test cleanup
   - This will allow tests to reset the counter between runs for isolation

4. **Add explicit return after already-open file case**
   - In `openFile`, add `return { success: true }` after focusing the already-open file's window

5. **Fix typo**
   - Change "acrtive" to "active" in the comment on line 177

## Implementation Notes

All acceptance criteria have been implemented:

### Changes Made (`src/main/ActionManager.ts`)

1. **Race condition fix (Critical)**: Moved `fs.writeFile()` calls BEFORE store updates in:
   - `onSaveResponse()` - both new file save and existing file save paths (lines 353, 395)
   - `onSaveAsResponse()` - Save As flow (line 475)

2. **Parse error details**: Updated error message to include the actual error from `parseTldrawJsonFile`:
   - Changed `throw new Error('Failed to parse file')` to `throw new Error(\`Failed to parse file: \${parseFileResult.error}\`)`

3. **Test isolation**: Exported `resetTestSaveId()` function for test cleanup (lines 11-16)

4. **Explicit return**: Added `return { success: true }` after focusing already-open file window (line 123)

5. **Typo fix**: Fixed "acrtive" → "active" in comment (line 185)

### Testing

- Added two new e2e tests in `Save Operations` test suite:
  - `should clear dirty state only after save completes` - validates dirty state transitions
  - `should preserve content across save cycle` - validates content persistence
- All File Operations tests pass
- TypeScript compilation passes
- ESLint passes for ActionManager.ts
