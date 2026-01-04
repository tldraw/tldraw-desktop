# macOS Titlebar Shows Duplicate Window Control Buttons

**Status:** `closed`
**Priority:** `medium`
**Type:** `bug`

## Description

On recent macOS versions, the window titlebar shows duplicate window control buttons - both the native macOS traffic lights (close/minimize/maximize) AND custom placeholder buttons rendered by the app. This creates a visually confusing double-set of circles in the top-left corner.

## Context

The current implementation renders custom placeholder buttons in `Titlebar.tsx` to reserve space for the native traffic lights and handle focus/blur states. However, on recent macOS versions, this creates a visual artifact where both the native controls and the placeholder buttons are visible simultaneously.

## Acceptance Criteria

- [x] Only the native macOS traffic lights are visible (no duplicate/extra circles)
- [x] The titlebar drag region still works correctly
- [x] Window focus/blur states are properly reflected (native controls dim when unfocused)
- [x] The title text remains properly centered and doesn't overlap with traffic lights

## Technical Notes

**Affected files:**

- `src/renderer/src/components/Titlebar.tsx:26-39` - Custom window control buttons
- `src/renderer/src/index.css:261-281` - Styling for custom window controls
- `src/main/WindowManager.ts:354-372` - Electron window config with `trafficLightPosition`

**Current behavior:**
The app renders both native macOS traffic lights (positioned via `trafficLightPosition: { x: 11, y: 10 }`) AND custom placeholder buttons styled as gray circles with `background-color: #ccc`.

**Expected behavior:**
Only the native macOS traffic lights should be visible. The placeholder buttons should either be removed entirely or made invisible while still reserving the correct amount of space for the drag region.

## Related

- None identified

## Implementation Plan

### Root Cause

The app renders custom placeholder buttons (`<button>` elements styled as gray circles) in `Titlebar.tsx` while Electron simultaneously renders native macOS traffic lights via the `trafficLightPosition` config. On recent macOS versions, both are visible, creating duplicate circles.

### Solution: Conditional Rendering Based on Platform

Remove the placeholder button rendering on macOS entirely. The native traffic lights handle their own rendering, focus/blur dimming, and click behavior.

### Steps

1. **Add platform detection to Titlebar component**
   - File: `src/renderer/src/components/Titlebar.tsx`
   - Use `navigator.platform` or expose `process.platform` via preload to detect macOS
   - Create a constant like `const isMacOS = navigator.platform.toLowerCase().includes('mac')`

2. **Conditionally render window controls**
   - File: `src/renderer/src/components/Titlebar.tsx`
   - Wrap the `.editor__titlebar__window-controls` div in a conditional: `{!isMacOS && <div className="editor__titlebar__window-controls">...</div>}`
   - Keep the `{children}` rendering unchanged

3. **Clean up unused event listeners on macOS**
   - The `window-focus` and `window-blur` event listeners are only used to toggle `.window-controls-focused` class
   - On macOS, these listeners can be skipped since the buttons won't render
   - Native macOS handles traffic light dimming automatically

4. **CSS cleanup (optional)**
   - File: `src/renderer/src/index.css` lines 261-281
   - The styles for `.editor__titlebar__window-controls`, `.window-controls-focused`, and `.editor__titlebar__window-control` can remain (harmless) or be removed
   - Keep if planning future Windows/Linux custom window controls

### Testing

- [ ] Verify native traffic lights appear (red/yellow/green)
- [ ] Verify no duplicate gray circles visible
- [ ] Verify titlebar drag functionality works
- [ ] Verify title text is properly centered
- [ ] Verify traffic lights dim when window loses focus (native macOS behavior)
- [ ] Run `npm typecheck` and `npm lint`
- [ ] Run `npm e2e` - existing tests should pass (they don't depend on window control buttons)

### Edge Cases

- **Focus/blur tracking**: The IPC events are still used by MainManager for window state tracking; only the titlebar's visual response changes
- **Multi-monitor**: No impact - traffic light positioning is handled by Electron
- **Dark mode**: Native traffic lights use system colors (unaffected by CSS themes)
