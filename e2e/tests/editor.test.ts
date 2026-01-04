import { EditorPOM } from 'e2e/poms/editor-pom'
import { HomePOM } from 'e2e/poms/home-pom'
import { setupTestFile } from 'e2e/setup-test'

const { test, expect } = setupTestFile()

/** Theme CSS selectors - used to verify theme application */
const THEME_SELECTORS = {
	light: '.tla-theme__light',
	dark: '.tla-theme__dark',
} as const

test.describe('Editor Window', () => {
	test.describe('New File Creation', () => {
		test('should open to an empty canvas with Untitled title', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			await editor.expectShapeCount(0)
			await editor.expectTitleToContain('Untitled')
			await editor.expectCanvasVisible()
		})

		test('should create new file from editor File menu', async ({ app, homePom }) => {
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			const editor2 = await EditorPOM.After(app, () => editor1.menu.new())

			// Home should be hidden when editors are open
			await expect
				.poll(() => homePom.isHidden(), {
					timeout: 3000,
					message: 'Home should be hidden when editor windows are open',
				})
				.toBe(true)

			// Both editors should be open
			expect(editor1.page.isClosed()).toBe(false)
			expect(editor2.page.isClosed()).toBe(false)

			// Both should be new untitled files
			await editor1.expectTitleToContain('Untitled')
			await editor2.expectTitleToContain('Untitled')
		})

		test('should create new file via keyboard shortcut', async ({ app, homePom }) => {
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			const editor2 = await EditorPOM.After(app, () => editor1.kbds.newFile())

			expect(editor2.page.isClosed()).toBe(false)
			await editor2.expectTitleToContain('Untitled')
			await editor2.expectShapeCount(0)
		})
	})

	test.describe('File Operations', () => {
		test('should rename a saved file via File > Rename menu', async ({ app, homePom }) => {
			// Create and save a file with content
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.drawRectangle(100, 100)
			await editor.menu.save()
			await editor.expectTitleToContain(/test-/)

			// Capture original title
			const originalTitle = await editor.getTitleBar().textContent()

			// Rename the file
			await editor.menu.rename()

			// Wait for title to change (should contain 'renamed-')
			await editor.expectTitleToContain(/renamed-/)

			// Verify the file name actually changed (not same as original)
			const newTitle = await editor.getTitleBar().textContent()
			expect(newTitle).not.toBe(originalTitle)

			// Verify content is still preserved
			await editor.expectShapeCount(1)
		})

		test('should open a saved file via File > Open menu', async ({ app, homePom }) => {
			// Setup: Create and save a file with content
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.menu.save()
			await editor1.expectTitleToContain(/test-/)

			// Close the first editor and create a new one
			const home = await HomePOM.After(app, () => editor1.close())
			const editor2 = await EditorPOM.After(app, () => home.newFile())

			// Open the saved file via menu
			const editor3 = await EditorPOM.After(app, () => editor2.menu.open())

			// Verify windows have correct state
			await editor2.expectTitleToContain('Untitled')
			await editor3.expectTitleToContain(/test-/)
			await editor3.expectShapeCount(1) // Verify content loaded
		})

		test('should save file via keyboard shortcut', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.expectTitleToContain('Untitled')

			await editor.kbds.save()

			await editor.expectTitleToContain(/test-/)
		})

		test('should indicate unsaved changes in title', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.expectTitleToContain('Untitled')

			// Make a change to trigger dirty state
			await editor.drawRectangle(100, 100, 100, 100)
			await editor.expectShapeCount(1)

			// Title should indicate dirty state
			await editor.expectDirty()
		})

		test('should open file via keyboard shortcut', async ({ app, homePom }) => {
			// Setup: Create and save a file with content
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.expectShapeCount(1)
			await editor1.kbds.save()
			await editor1.expectTitleToContain(/test-/)

			// Close and create new editor
			const home = await HomePOM.After(app, () => editor1.close())
			const editor2 = await EditorPOM.After(app, () => home.newFile())

			// Open saved file via keyboard shortcut
			const editor3 = await EditorPOM.After(app, () => editor2.kbds.openFile())

			// Verify content was preserved
			await editor3.expectShapeCount(1)
		})
	})

	test.describe('Theme Preferences', () => {
		test('should set specific theme from editor menu', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			const lightTheme = editor.page.locator(THEME_SELECTORS.light)
			const darkTheme = editor.page.locator(THEME_SELECTORS.dark)

			// Verify starting state is light
			await expect(lightTheme).toBeVisible()

			// Switch to dark via in-app menu
			await editor.menu.setTheme('Dark')
			await expect(darkTheme).toBeVisible()

			// Switch back to light via in-app menu
			await editor.menu.setTheme('Light')
			await expect(lightTheme).toBeVisible()
		})
	})

	test.describe('Window Management', () => {
		test('should restore window bounds when reopening a saved file', async ({ app, homePom }) => {
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.menu.save()
			await editor1.expectTitleToContain(/test-/)

			// Set specific window bounds
			const targetBounds = { x: 100, y: 100, width: 800, height: 600 }
			await editor1.setWindowBounds(targetBounds)

			// Wait for bounds to be applied (may take a moment)
			await expect
				.poll(
					async () => {
						const bounds = await editor1.getWindowBounds()
						return bounds.width === targetBounds.width && bounds.height === targetBounds.height
					},
					{
						timeout: 1000,
						message: 'Window bounds should be applied',
					}
				)
				.toBe(true)

			// Save again to persist bounds, then capture actual bounds
			await editor1.menu.save()
			const savedBounds = await editor1.getWindowBounds()

			// Close and reopen from recent files
			const home = await HomePOM.After(app, () => editor1.close())
			const editor2 = await EditorPOM.After(app, () => home.openRecentFile(/test-/))

			// Verify bounds are restored
			const restoredBounds = await editor2.getWindowBounds()
			expect(restoredBounds.x).toBe(savedBounds.x)
			expect(restoredBounds.y).toBe(savedBounds.y)
			expect(restoredBounds.width).toBe(savedBounds.width)
			expect(restoredBounds.height).toBe(savedBounds.height)
		})

		test('should close editor and return to home when closing last editor', async ({
			app,
			homePom,
		}) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			const home = await HomePOM.After(app, () => editor.close())

			await expect
				.poll(() => home.isShowing(), {
					timeout: 1000,
					message: 'Home should be visible after closing last editor',
				})
				.toBe(true)
			expect(editor.page.isClosed()).toBe(true)
		})
	})

	test.describe('Canvas Interactions', () => {
		test('should select tools via keyboard shortcuts', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Test a representative sample of tool shortcuts
			await editor.toolKbds.draw()
			await editor.expectCurrentTool('draw')

			await editor.toolKbds.select()
			await editor.expectCurrentTool('select')

			await editor.toolKbds.rectangle()
			await editor.expectCurrentTool('geo')

			await editor.toolKbds.hand()
			await editor.expectCurrentTool('hand')

			await editor.toolKbds.eraser()
			await editor.expectCurrentTool('eraser')
		})

		test('should draw multiple shapes and count them', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.expectShapeCount(0)

			// Draw three rectangles at different positions
			await editor.drawRectangle(100, 100, 100, 100)
			await editor.drawRectangle(250, 100, 100, 100)
			await editor.drawRectangle(400, 100, 100, 100)

			await editor.expectShapeCount(3)
		})

		test('should return valid shape IDs when drawing', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			const shapeId = await editor.drawRectangle(100, 100, 100, 100)

			// Verify shape ID is valid and retrievable
			expect(shapeId).toBeTruthy()
			const shapeIds = await editor.getShapeIds()
			expect(shapeIds).toContain(shapeId)
		})

		test('should create shapes with unique IDs', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			const id1 = await editor.drawRectangle(100, 100)
			const id2 = await editor.drawRectangle(200, 100)
			const id3 = await editor.drawRectangle(300, 100)

			await editor.expectShapeCount(3)
			// All IDs should be unique
			const uniqueIds = new Set([id1, id2, id3])
			expect(uniqueIds.size).toBe(3)
		})

		test('should select and delete shapes', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			await editor.drawRectangle(100, 100)
			await editor.drawRectangle(200, 100)
			await editor.expectShapeCount(2)

			// Select all shapes using the programmatic method
			await editor.selectAllShapes()
			await editor.expectSelectedShapeCount(2)

			// Delete selected shapes and verify canvas is empty
			await editor.deleteSelectedShapes()
			await editor.expectShapeCount(0)
		})

		test('should support undo and redo operations', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Draw a shape
			await editor.drawRectangle(100, 100)
			await editor.expectShapeCount(1)

			// Undo should remove the shape
			await editor.kbds.undo()
			await editor.expectShapeCount(0)

			// Redo should restore the shape
			await editor.kbds.redo()
			await editor.expectShapeCount(1)
		})
	})

	test.describe('Open Recent Menu', () => {
		test('should open recent file from File > Open Recent menu', async ({ app, homePom }) => {
			// Create and save a file with content
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.menu.save()
			await editor1.expectTitleToContain(/test-/)

			// Close the editor
			const home = await HomePOM.After(app, () => editor1.close())

			// Create a new editor
			const editor2 = await EditorPOM.After(app, () => home.newFile())

			// Open the recently saved file from the Open Recent menu (index 0 = most recent)
			const editor3 = await EditorPOM.After(app, () => editor2.appMenu.file.openRecent.byIndex(0))

			// Verify the recent file opened with content
			await editor3.expectTitleToContain(/test-/)
			await editor3.expectShapeCount(1)
		})

		test('should clear recent files list from File > Open Recent > Clear Recent', async ({
			app,
			homePom,
		}) => {
			// Create and save a file
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.menu.save()
			await editor1.expectTitleToContain(/test-/)

			// Clear the recent files list
			await editor1.appMenu.file.openRecent.clear()

			// Close the editor
			const home = await HomePOM.After(app, () => editor1.close())

			// Verify the home screen shows no recent files
			// The recent file button should not exist
			await expect(home.getRecentFile(/test-/)).not.toBeVisible()
		})
	})

	test.describe('Native Edit Menu', () => {
		test('should delete selected shapes via Edit > Delete menu', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Draw shapes
			await editor.drawRectangle(100, 100)
			await editor.drawRectangle(200, 100)
			await editor.expectShapeCount(2)

			// Select all shapes
			await editor.appMenu.edit.selectAll()
			await editor.expectSelectedShapeCount(2)

			// Delete via Edit menu
			await editor.appMenu.edit.delete()
			await editor.expectShapeCount(0)
		})

		test('should duplicate selected shapes via Edit > Duplicate menu', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Draw a shape
			await editor.drawRectangle(100, 100)
			await editor.expectShapeCount(1)

			// Select all shapes
			await editor.appMenu.edit.selectAll()
			await editor.expectSelectedShapeCount(1)

			// Duplicate via Edit menu
			await editor.appMenu.edit.duplicate()
			await editor.expectShapeCount(2)
		})

		test('should undo and redo via Edit menu', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Draw a shape
			await editor.drawRectangle(100, 100)
			await editor.expectShapeCount(1)

			// Undo via Edit menu
			await editor.appMenu.edit.undo()
			await editor.expectShapeCount(0)

			// Redo via Edit menu
			await editor.appMenu.edit.redo()
			await editor.expectShapeCount(1)
		})
	})

	test.describe('Document Identity', () => {
		test('should preserve document ID across close/reopen cycles', async ({ app, homePom }) => {
			// Create, save, and get document ID
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.menu.save()
			await editor1.expectTitleToContain(/test-/)

			const docId1 = await editor1.getDocumentId()
			expect(docId1, 'Document should have an ID after save').toBeTruthy()

			// Close and reopen from recent files
			const home = await HomePOM.After(app, () => editor1.close())
			const editor2 = await EditorPOM.After(app, () => home.openRecentFile(/test-/))

			// Document ID should be preserved
			const docId2 = await editor2.getDocumentId()
			expect(docId2).toBe(docId1)
		})

		test('new files should have unique document IDs', async ({ app, homePom }) => {
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			const editor2 = await EditorPOM.After(app, () => editor1.menu.new())

			const docId1 = await editor1.getDocumentId()
			const docId2 = await editor2.getDocumentId()

			expect(docId1, 'First document should have an ID').toBeTruthy()
			expect(docId2, 'Second document should have an ID').toBeTruthy()
			expect(docId1, 'Document IDs should be unique').not.toBe(docId2)
		})

		test('document ID should remain stable after edits', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Get ID before any edits
			const initialDocId = await editor.getDocumentId()
			expect(initialDocId).toBeTruthy()

			// Make multiple edits
			await editor.drawRectangle(100, 100)
			await editor.drawRectangle(200, 200)
			await editor.expectShapeCount(2)

			// ID should remain the same
			const afterEditsDocId = await editor.getDocumentId()
			expect(afterEditsDocId).toBe(initialDocId)
		})
	})
})
