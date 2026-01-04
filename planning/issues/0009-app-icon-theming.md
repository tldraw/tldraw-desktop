# App Icon Theming

**Status:** `open`
**Priority:** `low`
**Type:** `enhancement`

## Description

Update the app icon based on user theme preferences (light/dark mode).

## Context

Some apps change their dock/taskbar icon to match the system or app theme. Currently marked as TODO in StoreManager.

## Acceptance Criteria

- [ ] App icon changes when theme preference changes
- [ ] Light icon for dark mode (for visibility)
- [ ] Dark icon for light mode (for visibility)
- [ ] Works on macOS dock
- [ ] Works on Windows taskbar (if applicable)

## Technical Notes

**Affected files:**

- `src/main/StoreManager.ts:148` - TODO: "update the app icon based on user preferences"

**Implementation approach:**

1. Create light and dark variants of app icon
2. Use `app.dock.setIcon()` on macOS
3. Use `BrowserWindow.setIcon()` for window icons
4. Listen to theme preference changes
5. May need to handle system theme vs app theme

**Platform considerations:**

- macOS: `app.dock.setIcon(path)`
- Windows: `BrowserWindow.setIcon(path)`
- Linux: May vary by desktop environment

## Related

- None

## Implementation Plan

...

## Implementation Notes

...
