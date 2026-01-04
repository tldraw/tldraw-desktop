# Add option to open in tldraw.com

**Status:** `blocked`
**Priority:** `medium`
**Type:** `feature`

## Description

Add a menu option or button that allows users to open their current .tldr file in the tldraw.com web editor. This would enable users to share their work, collaborate with others, or access web-specific features not available in the desktop app.

This is `blocked` because it would require integrations on tldraw.com.

## Context

Users may want to:

- Share their tldraw canvas with others who don't have the desktop app
- Access collaboration features available on tldraw.com
- Use web-specific features or the latest web version
- Open their work in a browser for quick sharing or embedding

## Acceptance Criteria

- [ ] Add a "Open in tldraw.com" menu item in the File menu
- [ ] The option should be available when a file is open in the editor
- [ ] Clicking the option should open the user's default browser with tldraw.com
- [ ] Save a temporary .tldr file that can be imported via File > Open in tldraw.com
- [ ] Consider adding a "Copy file for web" option that copies the .tldr content to clipboard
- [ ] Provide appropriate user guidance via dialog or notification

## Technical Notes

**Affected files:**

- `src/main/MenuManager.ts:31-110` - Add new menu item in File submenu
- `src/main/ActionManager.ts` - Add `openInTldrawCom()` action handler
- `src/main/WindowManager.ts:38,68` - Uses `shell.openExternal()` pattern already

**Current patterns to follow:**

1. Menu items are added in `MenuManager.ts` with click handlers that call `this.mainManager.actions.<method>()`
2. Actions in `ActionManager.ts` return `Promise<ActionResult>` for consistent error handling
3. `shell.openExternal()` from Electron is already imported in `WindowManager.ts` and used for external links
4. For getting file content from renderer, the existing `editor-save-request`/`editor-save-response` IPC pattern can be reused

**tldraw.com file loading:**

tldraw.com (as of 2025) does not have a public URL parameter API for directly loading .tldr files. Users must:

1. Go to https://www.tldraw.com/
2. Use Menu > File > Open to select a .tldr file from their filesystem

This means the implementation should focus on:

- Opening tldraw.com in the browser
- Ensuring the user has the .tldr file saved locally so they can import it
- Potentially copying the file path or showing instructions

## Related

- None

## Implementation Plan

### Option A: Simple "Open tldraw.com" with save prompt (Recommended)

This is the simplest and most reliable approach:

1. **Add menu item** in `src/main/MenuManager.ts`:
   - Add "Open in tldraw.com..." item after "Save as" (around line 82)
   - Pattern: `{ label: 'Open in tldraw.com...', id: 'open-in-tldraw-com', click: () => this.mainManager.actions.openInTldrawCom() }`

2. **Add action** in `src/main/ActionManager.ts`:

   ```typescript
   async openInTldrawCom(): Promise<ActionResult> {
     try {
       const openFileData = this.mainManager.store.getActiveOpenFileData()

       // If there's an open file with unsaved changes, prompt to save first
       if (openFileData?.unsavedChanges) {
         const result = await dialog.showMessageBox({
           type: 'info',
           buttons: ['Save and Continue', 'Continue Without Saving', 'Cancel'],
           message: 'Save before opening in tldraw.com?',
           detail: 'Your file will need to be saved locally to open it in tldraw.com.'
         })

         if (result.response === 0) {
           await this.saveCurrentFile()
         } else if (result.response === 2) {
           return { success: false, error: 'cancelled' }
         }
       }

       // If file is saved, show helpful dialog with file location
       if (openFileData?.filePath) {
         await dialog.showMessageBox({
           type: 'info',
           message: 'Opening tldraw.com',
           detail: `Your file is saved at:\n${openFileData.filePath}\n\nIn tldraw.com, use Menu > File > Open to import your file.`
         })
       }

       // Open tldraw.com in default browser
       await shell.openExternal('https://www.tldraw.com/')
       return { success: true }
     } catch (err: any) {
       return { success: false, error: err.message }
     }
   }
   ```

3. **Import shell** in `ActionManager.ts`:
   - Add `shell` to the electron import: `import { app, BrowserWindow, dialog, shell } from 'electron'`

### Option B: Copy .tldr content to clipboard

Alternative approach for easier transfer:

1. Add "Copy for tldraw.com" menu item
2. Serialize the current file using existing `serializeTldrawJson` pattern
3. Copy to clipboard using Electron's `clipboard.writeText()`
4. Show dialog instructing user to paste in tldraw.com (if supported)

Note: tldraw.com may support paste from clipboard for .tldr JSON content.

### Option C: Temporary file + reveal in Finder/Explorer

1. Save to a temporary location if file is unsaved
2. Use `shell.showItemInFolder()` to reveal the file
3. Open tldraw.com
4. User can drag-and-drop or use File > Open

### Recommended: Start with Option A

Option A is recommended because:

- Simplest implementation (< 30 lines of code)
- Uses existing patterns in the codebase
- No new IPC events needed
- Gracefully handles unsaved changes
- Clear user flow with helpful dialog

### Files to modify:

1. `src/main/ActionManager.ts`:
   - Add `shell` to electron imports (line 1)
   - Add `openInTldrawCom()` method (~20-30 lines)

2. `src/main/MenuManager.ts`:
   - Add menu item in File submenu (after "Save as", around line 82)

### Testing considerations:

- Test with saved file: should show file path in dialog
- Test with unsaved file: should prompt to save first
- Test with new empty file: should work without file path
- Test cancel flows: should not open browser
- Verify browser opens to tldraw.com correctly on all platforms
