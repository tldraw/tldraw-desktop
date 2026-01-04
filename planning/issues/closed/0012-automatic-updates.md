# Automatic Updates

**Status:** `closed`
**Priority:** `medium`
**Type:** `enhancement`

## Description

Enhance the existing auto-updater functionality to provide a complete, robust automatic update experience. The app currently has a basic `UpdateManager` that uses `electron-updater`, but it needs improvements for production readiness including better UX, error handling, user preferences, and platform-specific considerations.

## Context

The tldraw desktop app already has foundational auto-update code in `UpdateManager.ts` that uses `electron-updater` with GitHub as the release provider. However, the current implementation has several gaps:

1. No user preference to disable/enable automatic update checks
2. No menu item to manually check for updates
3. Limited error handling and user feedback
4. No download progress indication
5. The `update-available` event handler recursively calls `checkForUpdates()` which could cause issues
6. No consideration for background vs manual update checks (different UX needed)

## Acceptance Criteria

- [x] Users can enable/disable automatic update checks via preferences
- [x] Users can manually check for updates via Help menu
- [x] Error states are communicated clearly to users (probably same menu item)
- [ ] Updates work correctly on all platforms (macOS, Windows, Linux) (skip)
- [x] Silent background checks don't interrupt the user unnecessarily
- [x] Manual checks provide feedback even when no update is available

## Technical Notes

**Affected files:**

- `src/main/UpdateManager.ts` - Main update logic (needs enhancement)
- `src/main/MenuManager.ts` - Add "Check for Updates" menu item
- `src/main/StoreManager.ts` - Add update preferences
- `src/types.ts` - Add update-related types if needed

**Current behavior:**

- UpdateManager initializes and checks for updates on app start
- Shows dialog when update available, prompts to download
- Shows dialog when download complete, prompts to restart
- Logs errors to console

**Expected behavior:**

- Respect user preference for auto-check
- Provide manual check option in Help menu
- Show download progress
- Handle errors gracefully with user-friendly messages
- Differentiate between background and manual checks

**Implementation approach:**
Enhance the existing UpdateManager with additional event handlers, progress tracking, user preferences integration, and menu integration.

## Related

- electron-updater documentation: https://www.electron.build/auto-update

## Implementation Plan

### Step 1: Add User Preference for Auto-Updates

**File:** `src/types.ts`

Add `autoCheckUpdates` to `AppStoreSchema['userPreferences']`:

```typescript
userPreferences: {
	theme: 'light' | 'dark'
	isGridMode: boolean
	isToolLocked: boolean
	exportBackground: boolean
	autoCheckUpdates: boolean // NEW - default to true
}
```

**File:** `src/main/StoreManager.ts`

1. Update `version` to `'1.0.3'`
2. Add migration `'1.0.3'` that adds `autoCheckUpdates: true` to userPreferences
3. Update the default userPreferences atom to include `autoCheckUpdates: true`

### Step 2: Enhance UpdateManager with Progress and Manual Check Support

**File:** `src/main/UpdateManager.ts`

Rewrite the UpdateManager with these improvements:

1. **Add state tracking:**

   ```typescript
   private isManualCheck = false
   private isCheckingForUpdates = false
   ```

2. **Fix the `update-available` event handler** (currently calls checkForUpdates recursively which is a bug):

   ```typescript
   autoUpdater.on('update-available', async (info) => {
   	// Remove the recursive checkForUpdates() call
   	// Just prompt user for download
   })
   ```

3. **Add download progress handler:**

   ```typescript
   autoUpdater.on('download-progress', (progress) => {
   	// Show progress in a dialog or window
   	// progress.percent, progress.bytesPerSecond, progress.total, progress.transferred
   })
   ```

4. **Add `checking-for-update` event handler:**

   ```typescript
   autoUpdater.on('checking-for-update', () => {
   	this.isCheckingForUpdates = true
   })
   ```

5. **Add `update-not-available` event handler** for manual check feedback:

   ```typescript
   autoUpdater.on('update-not-available', async () => {
   	if (this.isManualCheck) {
   		const activeWindow = BrowserWindow.getFocusedWindow()
   		if (activeWindow) {
   			dialog.showMessageBox(activeWindow, {
   				type: 'info',
   				title: 'No Updates Available',
   				message: `You're running the latest version (${app.getVersion()}).`,
   				buttons: ['OK'],
   			})
   		}
   	}
   	this.isCheckingForUpdates = false
   	this.isManualCheck = false
   })
   ```

6. **Improve error handling:**

   ```typescript
   autoUpdater.on('error', (error) => {
   	console.error('Update error:', error)
   	if (this.isManualCheck) {
   		const activeWindow = BrowserWindow.getFocusedWindow()
   		if (activeWindow) {
   			dialog.showMessageBox(activeWindow, {
   				type: 'error',
   				title: 'Update Error',
   				message: 'Failed to check for updates. Please try again later.',
   				detail: error.message,
   				buttons: ['OK'],
   			})
   		}
   	}
   	this.isCheckingForUpdates = false
   	this.isManualCheck = false
   })
   ```

7. **Update `initialize()` to respect user preferences:**

   ```typescript
   async initialize() {
     // ... existing dev config setup ...

     const userPrefs = this.mainManager.store.getUserPreferences()
     if (userPrefs.autoCheckUpdates) {
       try {
         await this.checkForUpdates(false) // false = background check
       } catch (error) {
         console.error('Error checking for updates:', error)
       }
     }
   }
   ```

8. **Update `checkForUpdates()` to accept manual flag:**

   ```typescript
   async checkForUpdates(manual = false) {
     if (this.isCheckingForUpdates) return

     this.isManualCheck = manual
     this.isCheckingForUpdates = true

     try {
       const result = await autoUpdater.checkForUpdates()
       // ... existing logic but without recursive call ...
     } catch (error) {
       // Error handler will be called via event
       throw error
     }
   }
   ```

### Step 3: Add Menu Preference for Auto-Updates

**File:** `src/main/MenuManager.ts`

1. Update the Help menu "Check for Updates..." item to pass `true` for manual check:

   ```typescript
   {
     label: 'Check for Updates...',
     click: () => {
       this.mainManager.updates.checkForUpdates(true) // manual check
     },
   }
   ```

2. Add auto-update toggle to Preferences submenu in File menu:

   ```typescript
   {
     label: 'Preferences',
     submenu: [
       {
         label: 'Change theme',
         // ... existing ...
       },
       {
         label: 'Check for updates automatically',
         type: 'checkbox',
         checked: this.mainManager.store.getUserPreferences().autoCheckUpdates,
         click: (menuItem) => {
           this.mainManager.store.updateUserPreferences((v) => ({
             ...v,
             autoCheckUpdates: menuItem.checked,
           }))
         },
       },
     ],
   }
   ```

3. The menu needs to be rebuilt when preferences change, OR use `menu.getMenuItemById()` to update the checked state dynamically.

### Step 4: Add Download Progress Dialog (Optional Enhancement)

For a better UX, show download progress:

**Option A - Simple progress dialog:**
Use `dialog.showMessageBox` with a progress message that updates.

**Option B - Progress in a window:**
Create a small progress window that shows download percentage.

For MVP, Option A is sufficient - show an initial "Downloading update..." message and then the "Update Ready" dialog when complete.

### Step 5: Testing Considerations

1. **Development testing:** Use `dev-app-update.yml` with `GH_TOKEN` environment variable
2. **Manual testing scenarios:**
   - Background check on app start (with preference enabled)
   - Background check skipped (with preference disabled)
   - Manual check when update available
   - Manual check when no update available
   - Manual check with network error
   - Download progress display
   - Install prompt after download

### Step 6: Platform-Specific Notes

- **macOS:** Code signing required for auto-update. App needs to be notarized.
- **Windows:** NSIS or Squirrel installer handles updates. No code signing required but recommended.
- **Linux:** AppImage supports auto-update. Other formats may not.

The current `electron-builder.yml` is already configured for GitHub releases with code signing for macOS.

### Files to Modify Summary

| File                        | Changes                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `src/types.ts`              | Add `autoCheckUpdates` to `userPreferences` type            |
| `src/main/StoreManager.ts`  | Add migration, update defaults                              |
| `src/main/UpdateManager.ts` | Major refactor: add progress, manual check support, fix bug |
| `src/main/MenuManager.ts`   | Add auto-update preference toggle                           |

### Risks and Edge Cases

1. **Race condition:** User triggers manual check while background check is running - handled by `isCheckingForUpdates` flag
2. **No focused window:** Some handlers check for focused window - may need fallback
3. **Network failures:** Should fail gracefully with user-friendly message
4. **Private repo access:** Requires `GH_TOKEN` for private repos - already handled in current code

## Implementation Notes

**Changes made:**

1. **`src/types.ts`**: Added `autoCheckUpdates: boolean` to `userPreferences` in both `AppStoreSchema` and `ConfigSchema`

2. **`src/main/StoreManager.ts`**:
   - Updated default `userPreferences` atom to include `autoCheckUpdates: true`
   - Updated migration default to include `autoCheckUpdates: true`
   - Added backward compatibility for existing configs (defaults to `true` if not present)

3. **`src/main/UpdateManager.ts`**: Major refactor:
   - Added `isManualCheck` and `isCheckingForUpdates` state flags
   - Fixed recursive `checkForUpdates()` bug in `update-available` handler
   - Added `checking-for-update` event handler
   - Added `update-not-available` handler that shows dialog only for manual checks
   - Improved error handling with user-facing dialogs for manual checks
   - `initialize()` now respects `autoCheckUpdates` preference
   - `checkForUpdates(manual)` accepts parameter to differentiate manual vs background checks
   - Background checks skip dialogs if no window is focused
   - Manual checks use any available window as fallback

4. **`src/main/MenuManager.ts`**:
   - "Check for Updates..." now passes `true` for manual check
   - Added "Check for Updates Automatically" checkbox in Preferences submenu

5. **`src/renderer/src/components/sharedAtoms.ts`**: Updated default `userPreferencesAtom` to include `autoCheckUpdates: true`

**Manual Testing Steps:**
1. Run `npm run dev`
2. Go to File > Preferences > "Check for Updates Automatically" - verify checkbox exists and defaults to checked
3. Uncheck it, restart app - verify no update check happens on startup
4. Check it again - verify update check happens on startup
5. Help > "Check for Updates..." - verify it shows appropriate dialog (no update / error message)

**Note:** Full update testing requires published GitHub releases with proper artifacts.
