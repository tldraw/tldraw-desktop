# Implement License Page

**Status:** `closed`
**Priority:** `high`
**Type:** `feature`

## Description

The License page is a placeholder that only renders the text "License". It should display the app's license and third-party licenses.

## Context

Desktop apps typically include license information for legal compliance and transparency about open-source dependencies.

## Acceptance Criteria

- [x] Display app license (likely MIT or similar)
- [x] List major third-party licenses (tldraw, Electron, React)
- [x] Scrollable content for long license text
- [x] Styled consistently with app theme

## Technical Notes

**Affected files:**

- `src/renderer/src/pages/license.tsx` - Currently just returns `<>License</>`

**Implementation approach:**

1. Create license content (can be static or fetched from LICENSE file)
2. Include tldraw license attribution
3. Add scrollable container for license text
4. Support dark/light theme

## Related

- Related: #0002 (About page)

## Implementation Plan

...

## Implementation Notes

...
