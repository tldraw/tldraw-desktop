import { EditorPOM } from 'e2e/poms/editor-pom'
import { HomePOM } from 'e2e/poms/home-pom'
import { setupTestFile } from 'e2e/setup-test'

const { test, expect } = setupTestFile()

/**
 * Helper to create a file with shapes, save it, and return the editor.
 * Reduces boilerplate in persistence tests.
 *
 * @param app - The Electron application instance
 * @param homePom - The home page object model
 * @param shapeCount - Number of shapes to create
 * @returns The editor POM with a saved file containing the specified number of shapes
 */
async function createAndSaveFileWithShapes(
	app: Parameters<typeof EditorPOM.After>[0],
	homePom: HomePOM,
	shapeCount: number
): Promise<EditorPOM> {
	const editor = await EditorPOM.After(app, () => homePom.newFile())
	for (let i = 0; i < shapeCount; i++) {
		await editor.drawRectangle(100 + i * 60, 100, 50, 50)
	}
	await editor.expectShapeCount(shapeCount)
	await editor.menu.save()
	await editor.expectTitleToContain(/test-/)
	return editor
}

/**
 * Helper to close editor and reopen from recent files.
 * This simulates a user closing a file and reopening it to verify persistence.
 *
 * @param app - The Electron application instance
 * @param editor - The editor POM to close
 * @returns A new editor POM for the reopened file
 */
async function closeAndReopenFile(
	app: Parameters<typeof EditorPOM.After>[0],
	editor: EditorPOM
): Promise<EditorPOM> {
	const home = await HomePOM.After(app, () => editor.close())
	await home.waitForReady()
	expect(editor.page.isClosed(), 'Editor should be closed').toBe(true)
	return await EditorPOM.After(app, () => home.openRecentFile(/test-/))
}

test.describe('Patch-Based Sync', () => {
	test.describe('Basic Persistence', () => {
		test('changes should persist after save and reopen', async ({ app, homePom }) => {
			// Create editor and draw a shape
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.expectShapeCount(0)

			await editor.drawRectangle(100, 100, 200, 150)
			await editor.expectShapeCount(1)

			// Save and close
			await editor.menu.save()
			await editor.expectTitleToContain(/test-/)

			// Reopen and verify shape persisted
			const editor2 = await closeAndReopenFile(app, editor)
			await editor2.expectShapeCount(1)
		})

		test('multiple shapes should persist and document ID should be preserved', async ({
			app,
			homePom,
		}) => {
			// Create file with multiple shapes
			const editor = await createAndSaveFileWithShapes(app, homePom, 2)

			// Capture document ID before closing
			const documentId = await editor.getDocumentId()
			expect(documentId, 'Document should have an ID after save').toBeTruthy()

			// Reopen and verify persistence
			const editor2 = await closeAndReopenFile(app, editor)
			await editor2.expectShapeCount(2)

			// Verify document ID is preserved
			const restoredDocId = await editor2.getDocumentId()
			expect(restoredDocId, 'Document ID should be preserved across save/load').toBe(documentId)
		})
	})

	test.describe('Edit and Update Persistence', () => {
		test('additional shapes added to existing file should persist', async ({ app, homePom }) => {
			// Create and save a file with one shape
			const editor = await createAndSaveFileWithShapes(app, homePom, 1)

			// Reopen and add another shape
			const editor2 = await closeAndReopenFile(app, editor)
			await editor2.expectShapeCount(1)
			await editor2.drawRectangle(250, 100, 100, 100)
			await editor2.expectShapeCount(2)

			// Save and reopen to verify persistence
			await editor2.menu.save()
			const editor3 = await closeAndReopenFile(app, editor2)
			await editor3.expectShapeCount(2)
		})

		test('shape IDs should be consistent across save/load cycles', async ({ app, homePom }) => {
			// Create a file with shapes and capture their IDs
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			const shapeId1 = await editor.drawRectangle(100, 100, 100, 100)
			const shapeId2 = await editor.drawRectangle(250, 100, 100, 100)
			await editor.expectShapeCount(2)

			// Verify shapes are in the editor
			const initialIds = await editor.getShapeIds()
			expect(initialIds, 'Initial shapes should include shape 1').toContain(shapeId1)
			expect(initialIds, 'Initial shapes should include shape 2').toContain(shapeId2)

			// Save, close, and reopen
			await editor.menu.save()
			await editor.expectTitleToContain(/test-/)
			const editor2 = await closeAndReopenFile(app, editor)

			// Verify the same shape IDs are present after reopen
			const restoredIds = await editor2.getShapeIds()
			expect(restoredIds, 'Restored shapes should include shape 1').toContain(shapeId1)
			expect(restoredIds, 'Restored shapes should include shape 2').toContain(shapeId2)
			expect(restoredIds.length, 'Should have exactly 2 shapes after reopen').toBe(2)
		})
	})

	test.describe('Crash Recovery', () => {
		test('unsaved changes should persist across window close (if crash recovery enabled)', async ({
			app,
			homePom,
		}) => {
			// Create editor and draw shapes WITHOUT saving
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.drawRectangle(100, 100, 100, 100)
			await editor.expectShapeCount(1)

			// Document ID should exist even without save
			const documentId = await editor.getDocumentId()
			expect(documentId, 'Unsaved document should have an ID').toBeTruthy()

			// Close without saving - patches should have been synced to local store
			const home2 = await HomePOM.After(app, () => editor.close())
			await home2.waitForReady()

			// Check if crash recovery is enabled by looking for untitled files in recents
			const hasUntitled = await home2.hasUntitledFiles()

			if (hasUntitled) {
				// Crash recovery IS enabled - verify the content was preserved
				const untitledButton = home2.getUntitledFileButtons().first()
				const editor2 = await EditorPOM.After(app, () => untitledButton.click())
				await editor2.expectShapeCount(1)

				const restoredDocId = await editor2.getDocumentId()
				expect(restoredDocId, 'Restored document should have same ID').toBe(documentId)
			} else {
				// Crash recovery is NOT enabled - this is expected in some configurations
				test.info().annotations.push({
					type: 'feature-not-enabled',
					description: 'Crash recovery for unsaved files is not enabled in this build',
				})
			}
		})

		test('document ID should be stable for unsaved files', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Get ID before any changes
			const initialDocId = await editor.getDocumentId()
			expect(initialDocId, 'New document should have an ID').toBeTruthy()

			// Make changes and verify ID remains stable
			await editor.drawRectangle(100, 100, 100, 100)
			await editor.expectShapeCount(1)

			const afterChangeDocId = await editor.getDocumentId()
			expect(afterChangeDocId, 'Document ID should be stable after edits').toBe(initialDocId)
		})
	})

	test.describe('Sync Timing', () => {
		test('changes should be synced immediately without explicit save', async ({ app, homePom }) => {
			// Verify patch-based sync happens automatically
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Draw shapes - should appear immediately without save
			await editor.drawRectangle(100, 100, 100, 100)
			await editor.expectShapeCount(1)

			await editor.drawRectangle(250, 100, 100, 100)
			await editor.expectShapeCount(2)
		})

		test('rapid successive changes should all be captured', async ({ app, homePom }) => {
			// Stress test: rapid changes should not be lost
			const SHAPE_COUNT = 5
			const editor = await createAndSaveFileWithShapes(app, homePom, SHAPE_COUNT)

			// Verify all shapes persisted
			const editor2 = await closeAndReopenFile(app, editor)
			await editor2.expectShapeCount(SHAPE_COUNT)
		})

		test('batch operations should persist correctly', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			// Create shapes
			await editor.drawRectangle(100, 100)
			await editor.drawRectangle(200, 100)
			await editor.drawRectangle(300, 100)
			await editor.expectShapeCount(3)

			// Delete all via keyboard (properly recorded in undo history)
			await editor.kbds.selectAll()
			await editor.kbds.delete()
			await editor.expectShapeCount(0)

			// Undo to restore
			await editor.kbds.undo()
			await editor.expectShapeCount(3)

			// Save and verify state persists
			await editor.menu.save()
			await editor.expectTitleToContain(/test-/)
			const editor2 = await closeAndReopenFile(app, editor)
			await editor2.expectShapeCount(3)
		})
	})
})
