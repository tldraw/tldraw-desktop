# Dark Mode Icon Path Error

**Status:** `open`
**Priority:** `medium`
**Type:** `bug`

## Description

When switching to dark mode, an error is thrown about a missing icon file. The `checkIcon()` method in `StoreManager.ts` uses manual path construction with `__dirname` to locate icon files, which fails in the packaged app because the path resolution is different.

## Context

The app supports dynamic icon theming based on the light/dark mode preference. The icon files exist in `resources/` and are properly configured to be unpacked in `electron-builder.yml`, but the path construction in `StoreManager.ts` doesn't work reliably across development and production builds.

In `WindowManager.ts`, the icon is correctly imported using Vite's `?asset` query which handles path resolution for both environments. However, `StoreManager.ts` manually constructs paths using `path.join(__dirname, '..', '..', 'resources', ...)` which doesn't resolve to the correct location in the packaged app.

## Acceptance Criteria

- [ ] Dark mode toggle works without throwing errors
- [ ] Icon changes correctly when switching between light and dark themes
- [ ] Works in both development mode and packaged app
- [ ] Works on all platforms (macOS, Windows, Linux)

## Technical Notes

**Affected files:**

- `src/main/StoreManager.ts:381-402` - `checkIcon()` method with incorrect path resolution

**Current behavior:**
When `checkIcon()` runs after toggling to dark mode, it constructs a path like:
```
path.join(__dirname, '..', '..', 'resources', 'Icon-dark-1024.png')
```
This works in development but fails in production because `__dirname` points to a different location in the packaged app.

**Expected behavior:**
The icon should load successfully from the correct location in both development and production environments.

**Root cause:**
The issue is that `__dirname` in the packaged Electron app points to the `app.asar` bundle location, not the actual file system. The `?asset` import syntax that Vite uses (as seen in `WindowManager.ts:6`) properly handles this by returning the correct path for both environments.

## Related

- Related: #0009 (App Icon Theming enhancement)

## Implementation Plan

### Overview

The fix involves changing `StoreManager.ts` to use Vite's `?asset` import syntax instead of manual `__dirname` path construction. This matches the pattern already used in `WindowManager.ts`.

### Step 1: Add Static Icon Imports

At the top of `src/main/StoreManager.ts` (around line 6), add:

```typescript
import iconLight from '../../resources/Icon-1024.png?asset'
import iconDark from '../../resources/Icon-dark-1024.png?asset'
```

### Step 2: Update checkIcon() Method

Modify the `checkIcon()` method (lines 381-402) to use the imported paths:

```typescript
checkIcon() {
    const isDarkMode = this.userPreferences.get().theme === 'dark'
    if (this.darkIcon === isDarkMode) return
    this.darkIcon = isDarkMode

    // Use the statically imported icon paths
    const iconPath = isDarkMode ? iconDark : iconLight
    const icon = nativeImage.createFromPath(iconPath)

    if (!icon || icon.isEmpty()) throw Error('Failed to load icon from ' + iconPath)

    for (const window of BrowserWindow.getAllWindows()) {
        window.setIcon(icon)
    }

    if (process.platform === 'darwin') {
        app.dock?.setIcon(icon)
    }
}
```

### Why This Works

1. **Vite's `?asset` suffix** is a compile-time directive that returns the correct path for both development and production
2. **In development:** Returns the absolute path to the source file
3. **In production:** Returns a path using `import.meta.dirname` which resolves correctly within the asar structure
4. **Consistent with existing codebase:** `WindowManager.ts:6` already uses this pattern

### Why Dynamic Imports Won't Work

The `?asset` suffix is processed at compile-time, so you cannot use dynamic paths like:
```typescript
// ❌ This won't work
import(`../../resources/Icon-${theme}-1024.png?asset`)
```

Both icons must be imported statically at module level.

### Files to Modify

1. `src/main/StoreManager.ts`
   - Add imports at top (after existing imports)
   - Modify `checkIcon()` method (lines 381-402)

### Testing

1. **Development mode:** `npm run dev` → toggle theme → verify no error and icon changes
2. **Production build:** `npm run build:mac` → open packaged app → toggle theme → verify no error
3. Test both directions: light→dark and dark→light
4. Test all platforms if possible

## Implementation Notes

...
