# Write file data out per-file rather than one json file

**Status:** `closed`
**Priority:** `medium`
**Type:** `enhancement`

## Description

Change the storage architecture to write open file data to individual files instead of a single JSON file (`open-files.json`). Currently, all open files, recent files, user preferences, and feature flags are stored in one monolithic JSON file.

## Context

The current approach stores everything in a single `open-files.json` file. This has several drawbacks:

1. **Performance**: Every change to any open file requires rewriting the entire store, including all file content snapshots
2. **Data loss risk**: If the single file becomes corrupted, all unsaved data is lost
3. **Concurrency issues**: Multiple rapid updates to different files could cause race conditions
4. **Large file size**: As more files are opened, the store file grows significantly since it contains full tldraw content snapshots

Splitting to per-file storage would:

- Reduce write amplification (only write the file that changed)
- Isolate corruption to individual files
- Improve crash recovery (only lose data from the specific corrupted file)
- Enable better cleanup of stale data

## Acceptance Criteria

- [x] Open file data is written to individual files instead of a single JSON blob
- [x] User preferences and feature flags remain in a small config file
- [x] Recent files metadata is stored separately from open file content
- [x] Migration handles existing single-file stores
- [x] Crash recovery still works (no data loss for unsaved changes)
- [x] Performance is improved for stores with multiple open files

## Technical Notes

**Affected files:**

- `src/main/StoreManager.ts` - Core storage logic, persist/initialize methods
- `src/types.ts` - AppStoreSchema type definition

**Current behavior:**

- All data stored in `{userData}/open-files.json`
- `persist()` method writes entire store on every change
- `schedulePersist()` sets a flag checked by 1-second interval
- `initialize()` reads and migrates the single JSON file

**Expected behavior:**

- Open file content stored in `{userData}/files/{id}.json`
- Config stored in `{userData}/config.json` (preferences, flags, version)
- Recent files stored in `{userData}/recent-files.json` (metadata only)
- Each file persisted independently when it changes

## Related

- Related: #0006 (fix-on-change-persistence) - improves dirty tracking which affects when files are persisted

## Implementation Plan

### Overview

The current architecture stores all data in a single `open-files.json` file. This change will split storage into:

- `{userData}/config.json` - User preferences, feature flags, and store version
- `{userData}/recent-files.json` - Recent file metadata (no content)
- `{userData}/files/{id}.json` - Individual open file data (including content snapshots)

### Step 1: Update Type Definitions

**File:** `src/types.ts`

1. Create a new `ConfigSchema` type for the config file:

```typescript
export interface ConfigSchema {
	version: string
	userPreferences: {
		theme: 'light' | 'dark'
		isGridMode: boolean
		isToolLocked: boolean
		exportBackground: boolean
	}
	featureFlags: {}
}
```

2. Create a `RecentFilesSchema` type:

```typescript
export interface RecentFilesSchema {
	version: string
	files: Record<string, RecentFileData>
}
```

3. The existing `OpenFileData` type remains unchanged but will be stored in individual files.

### Step 2: Refactor StoreManager Storage Methods

**File:** `src/main/StoreManager.ts`

1. Update the file paths:

```typescript
private get configPath() { return path.join(this.userDataPath, 'config.json') }
private get recentFilesPath() { return path.join(this.userDataPath, 'recent-files.json') }
private get filesDir() { return path.join(this.userDataPath, 'files') }
private openFilePath(id: string) { return path.join(this.filesDir, `${id}.json`) }
```

2. Create separate persist methods:

- `persistConfig()` - Writes user preferences and feature flags
- `persistRecentFiles()` - Writes recent file metadata
- `persistOpenFile(id: string)` - Writes a single open file to its own JSON file
- `deleteOpenFile(id: string)` - Deletes the file when closed

3. Update `ContentManager` onChange callbacks:

- For `openFiles`: Call `persistOpenFile(id)` instead of `schedulePersist()`
- For `recentFiles`: Call `persistRecentFiles()` instead of `schedulePersist()`

4. Track dirty state per file instead of globally:

```typescript
private dirtyOpenFiles = new Set<string>()
```

### Step 3: Update Initialize Method

**File:** `src/main/StoreManager.ts`

1. Create the `files/` directory if it doesn't exist
2. Read config from `config.json`
3. Read recent files from `recent-files.json`
4. Scan `files/` directory and load each open file JSON
5. Handle migration from old single-file format:
   - If `open-files.json` exists, migrate data to new format
   - Delete `open-files.json` after successful migration

### Step 4: Update ContentManager Class

**File:** `src/main/StoreManager.ts`

1. Modify `create()`, `update()`, `remove()` methods to track which specific item changed
2. Pass the changed item ID to the `onChange` callback:

```typescript
onChange?: (
  data: Record<string, T>,
  reason: 'replace' | 'update' | 'create' | 'remove',
  changedId?: string
) => void
```

### Step 5: Handle File Cleanup

**File:** `src/main/StoreManager.ts`

1. When a file is closed (removed from openFiles), delete its JSON file
2. In `WindowManager.handleClosed`, ensure `openFiles.remove()` triggers file deletion
3. Add cleanup logic in `initialize()` to remove orphaned files in `files/` directory

### Step 6: Update Tests

**Directory:** `e2e/`

1. Update any tests that check for `open-files.json`
2. Ensure test fixtures handle the new directory structure
3. Verify migration tests pass

### Migration Strategy

1. On first run with new code:
   - Check if `open-files.json` exists
   - If yes, read it and migrate:
     - Write `config.json` with preferences/flags/version
     - Write `recent-files.json` with recent file data
     - Write each open file to `files/{id}.json`
   - Rename `open-files.json` to `open-files.json.backup`
   - Delete backup after confirming migration success

2. Version the new schema starting at `2.0.0` to distinguish from old format

### Affected Files Summary

| File                       | Changes                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `src/types.ts`             | Add `ConfigSchema`, `RecentFilesSchema` types                     |
| `src/main/StoreManager.ts` | Major refactor: split persist/initialize, add per-file operations |
| `e2e/setup-test.ts`        | Update test data directory handling if needed                     |

### Risks and Considerations

1. **Atomic writes**: Use `fs.writeFile` with a temp file + rename pattern to prevent corruption
2. **File system limits**: Large numbers of open files could hit inode limits (unlikely for typical use)
3. **Migration rollback**: Keep backup of old format for at least one version
4. **Race conditions**: Ensure `persistOpenFile` operations are serialized per file ID
5. **Disk space**: Individual files have slightly more overhead than combined JSON, but the total should be similar
