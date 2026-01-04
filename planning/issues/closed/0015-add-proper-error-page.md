# Add proper error page

**Status:** `closed`
**Priority:** `medium`
**Type:** `enhancement`

## Description

Create an error boundary UI that catches and displays errors gracefully instead of showing a blank or broken screen. Currently, the app has minimal error handling - the `ErrorBoundaryComponent` in `routes.tsx` only shows "Something went wrong" with no styling or user guidance, and the `error.tsx` page just displays "Error".

## Context

When errors occur in the renderer process, users see an unhelpful message with no styling, no ability to recover, and no indication of what went wrong. A proper error page should:

1. Match the app's visual design
2. Provide useful information about the error (in development)
3. Offer recovery options (reload, go home, etc.)
4. Optionally allow reporting errors

## Acceptance Criteria

- [x] Error boundary component displays a styled error UI consistent with the app's design
- [x] Error page includes a "Go Home" or "Reload" button for recovery
- [x] Error details are shown in development mode but hidden in production
- [x] The error UI includes the title bar for proper window controls
- [x] Both the router ErrorBoundary and the `/error` route use the improved UI

## Technical Notes

**Affected files:**

- `src/renderer/src/routes.tsx:4-8` - Current ErrorBoundaryComponent is minimal
- `src/renderer/src/pages/error.tsx` - Bare-bones error page
- `src/renderer/src/index.css` - Will need error page styles

**Current behavior:**

- `ErrorBoundaryComponent` renders just `<div>Something went wrong</div>`
- `error.tsx` renders just `<div>Error</div>`
- No styling, no recovery options, no error details

**Expected behavior:**

- Styled error UI matching the home page design
- Title bar present for window controls
- Reload/Go Home buttons for recovery
- Error stack trace visible in development mode

**Implementation approach:**

- Follow the styling patterns from `home.tsx` (layout classes, button styles)
- Include `TitleBar` component for consistent window chrome
- Use `useRouteError()` to access error details in the boundary
- Conditionally show error details based on `import.meta.env.DEV`

## Related

- Related: #0010 (about page - similar static page pattern)

## Implementation Plan

### Step 1: Create a reusable ErrorDisplay component

Create a new component at `src/renderer/src/components/ErrorDisplay.tsx` that can be used by both the error boundary and the error page route. This component should:

- Accept optional `error` and `errorInfo` props
- Use the `TitleBar` component for window controls
- Follow the `home__layout` / `home__container` pattern for consistent styling
- Include "Go Home" and "Reload" buttons
- Show error details (message + stack trace) only in development mode

```tsx
// Structure:
// - TitleBar
// - Container with:
//   - Error icon or tldraw logo
//   - "Something went wrong" heading
//   - Error message (dev only)
//   - Error stack trace in <pre> (dev only)
//   - Action buttons: Go Home, Reload
```

### Step 2: Add CSS styles for the error page

Add new styles to `src/renderer/src/index.css` after the home section (around line 502):

```css
/* ---------------------- Error ---------------------- */

.error__layout {
	/* Same as home__layout */
}
.error__container {
	/* Similar to home__container */
}
.error__heading {
	/* Large text for "Something went wrong" */
}
.error__message {
	/* Styled error message text */
}
.error__stack {
	/* Pre-formatted stack trace, scrollable */
}
.error__actions {
	/* Button container */
}
```

The styles should:

- Reuse existing color variables (`--tla-color-text-1`, `--tla-color-text-3`, etc.)
- Use the same button styles as `.home__button`
- Make the stack trace scrollable with a max-height
- Use a monospace font for the stack trace

### Step 3: Update the ErrorBoundaryComponent in routes.tsx

Modify `src/renderer/src/routes.tsx:4-8`:

```tsx
function ErrorBoundaryComponent() {
	const error = useRouteError()
	console.error(error)

	// Extract error message and stack
	const errorMessage = error instanceof Error ? error.message : String(error)
	const errorStack = error instanceof Error ? error.stack : undefined

	return <ErrorDisplay error={errorMessage} stack={errorStack} />
}
```

### Step 4: Update the error.tsx page

Update `src/renderer/src/pages/error.tsx` to use the new ErrorDisplay component:

```tsx
import { ErrorDisplay } from '@renderer/components/ErrorDisplay'

export function Component() {
	return <ErrorDisplay />
}
```

This page is navigated to explicitly (via `/error` route) so it may not have error details available.

### Step 5: Testing considerations

1. **Manual testing:**
   - Trigger a runtime error in the editor to verify the error boundary catches it
   - Navigate to `/error` directly to verify the error page renders
   - Test in both light and dark themes
   - Verify the title bar window controls work
   - Test the "Go Home" and "Reload" buttons

2. **Verify in production build:**
   - Run `npm run build:mac` and verify error details are hidden
   - Confirm the error UI still shows the user-friendly message

### Files to modify

1. **Create:** `src/renderer/src/components/ErrorDisplay.tsx`
2. **Edit:** `src/renderer/src/index.css` - Add error page styles
3. **Edit:** `src/renderer/src/routes.tsx` - Update ErrorBoundaryComponent
4. **Edit:** `src/renderer/src/pages/error.tsx` - Use ErrorDisplay component

### Edge cases

- Ensure the error boundary doesn't crash if the error object is null/undefined
- Handle both Error objects and string errors
- The TitleBar component requires IPC events - verify it works in error scenarios
- If TitleBar fails to render in error state, have a fallback that still shows window controls

## Implementation Notes

### Changes Made

1. **Created `src/renderer/src/components/ErrorDisplay.tsx`**
   - Reusable error display component with TitleBar for window controls
   - Shows "Something went wrong" heading
   - Displays error message and stack trace only in development mode (`import.meta.env.DEV`)
   - Includes "Go Home" and "Reload" buttons for recovery
   - Handles cases where error/stack are undefined (for direct `/error` route navigation)

2. **Added CSS styles in `src/renderer/src/index.css`**
   - Added `error__layout`, `error__container`, `error__heading`, `error__message`, `error__stack`, `error__actions`, and `error__button` classes
   - Follows existing patterns (similar to home/license/about pages)
   - Uses existing color variables and design system
   - Stack trace is scrollable with max-height for long traces

3. **Updated `src/renderer/src/routes.tsx`**
   - Updated `ErrorBoundaryComponent` to use the new `ErrorDisplay` component
   - Extracts error message and stack from the error object
   - Handles both Error objects and string errors

4. **Updated `src/renderer/src/pages/error.tsx`**
   - Now uses the `ErrorDisplay` component for consistent UI

### Testing Suggestions

- Run `npm run dev` and navigate to `/error` to see the error page
- Trigger a runtime error to test the error boundary (e.g., throw an error in a component)
- Test in both light and dark themes
- Verify window controls work on macOS and Windows/Linux
