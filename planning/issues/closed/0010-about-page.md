# Implement About Page

**Status:** `closed`
**Priority:** `high`
**Type:** `feature`

## Description

The About page is a placeholder that only renders the text "About". It should display app information, version, credits, and links.

## Context

Users access Help > About to see version info and credits. This is a standard desktop app feature.

## Acceptance Criteria

- [x] Display app name and logo
- [x] Show current version number (from package.json)
- [x] Display copyright notice
- [x] Show credits/attribution for tldraw SDK
- [x] Include link to project repository (if public)
- [x] Styled consistently with app theme

## Technical Notes

**Affected files:**

- `src/renderer/src/pages/about.tsx` - Currently just returns `<>About</>`

**Implementation approach:**

1. Import version from package.json or environment
2. Design layout with logo, version, copyright
3. Add tldraw attribution as required by license
4. Support dark/light theme

## Related

- Related: #0003 (License page)

## Implementation Plan

1. Add Vite define constants for app version and name in `electron.vite.config.mts`
2. Add TypeScript declarations for the global constants in `env.d.ts`
3. Create About page component with TitleBar, logo, version, description, and links
4. Add CSS styles following the license page pattern

## Implementation Notes

Implemented by:

- Adding `__APP_VERSION__` and `__APP_NAME__` as Vite define constants in `electron.vite.config.mts`
- Adding TypeScript declarations in `src/renderer/src/env.d.ts`
- Creating full About page layout in `src/renderer/src/pages/about.tsx` with:
  - TldrawLogo component centered at top
  - Version number displayed below logo
  - Description with attribution to tldraw SDK
  - Links section with GitHub repo, SDK docs, and tldraw.com
  - Footer with dynamic year and copyright
- Adding CSS styles in `src/renderer/src/index.css` following the license page pattern
