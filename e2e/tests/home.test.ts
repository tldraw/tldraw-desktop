import { EditorPOM } from 'e2e/poms/editor-pom'
import { HomePOM } from 'e2e/poms/home-pom'
import { setupTestFile } from 'e2e/setup-test'

const { test, expect } = setupTestFile()

test.describe('Home Window', () => {
	test('has correct initial state', async ({ homePom }) => {
		// Route and visibility
		expect(homePom.page.url()).toContain('#/home')
		await homePom.expectWindowVisible()

		// Window dimensions
		const bounds = await homePom.getWindowBounds()
		expect(bounds.width).toBe(900)
		expect(bounds.height).toBe(670)

		// UI elements
		await homePom.expectHomeVisible()
		await homePom.expectNewFileButtonEnabled()
		await homePom.expectRecentFileCount(0)
	})

	test.describe('Window Lifecycle', () => {
		test('hides when editors open and shows when all close', async ({ app, homePom }) => {
			// Open first editor - home hides
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await homePom.expectWindowHidden()

			// Open second editor - home stays hidden
			const editor2 = await EditorPOM.After(app, () => editor1.menu.new())
			expect(editor1.page.isClosed()).toBe(false)
			expect(editor2.page.isClosed()).toBe(false)
			await homePom.expectWindowHidden()

			// Close one editor - home stays hidden
			await editor2.close()
			await homePom.expectWindowHidden(1000, 'Home should remain hidden while editor1 is open')

			// Close last editor - home reappears
			await HomePOM.After(app, () => editor1.close())
			await homePom.expectWindowVisible(1000, 'Home should reappear after all editors are closed')
		})

		test('closing home window with no editors closes app', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await HomePOM.After(app, () => editor.close())
			await homePom.expectWindowVisible()

			await homePom.close()
			expect(homePom.page.isClosed()).toBe(true)
		})

		test('new editor uses preloaded window (no PRELOAD in URL)', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			expect(editor.page.url()).toContain('#/f/')
			expect(editor.page.url()).not.toContain('PRELOAD')
			await editor.expectCanvasVisible()
		})
	})

	test.describe('New File Creation', () => {
		test('navigates to editor URL with document ID pattern', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			expect(editor.page.url()).toContain('#/f/')
			// URL should have a document ID segment after /f/
			expect(editor.page.url()).toMatch(/#\/f\/[a-zA-Z0-9-]+/)
		})

		test('creates empty untitled file with zero shapes', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())

			await editor.expectTitleToContain('Untitled')
			await editor.expectShapeCount(0)
			await editor.expectCanvasVisible()
		})

		test('assigns unique document IDs to each new file', async ({ app, homePom }) => {
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			const editor2 = await EditorPOM.After(app, () => editor1.menu.new())

			// Both should be open and functional
			expect(editor1.page.isClosed()).toBe(false)
			expect(editor2.page.isClosed()).toBe(false)

			// Each file should have a unique document ID
			const docId1 = await editor1.getDocumentId()
			const docId2 = await editor2.getDocumentId()

			expect(docId1).toBeTruthy()
			expect(docId2).toBeTruthy()
			expect(docId1).not.toBe(docId2)
		})

		test('shows newly created editor window', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			// Verify window is visible and ready (focus is OS-dependent and unreliable in tests)
			await editor.expectCanvasVisible()
			expect(await editor.isShowing()).toBe(true)
		})

		test('creates multiple independent editors from home', async ({ app, homePom }) => {
			// Create first editor and add content
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.expectShapeCount(1)

			// Create second editor via File menu from first editor
			const editor2 = await EditorPOM.After(app, () => editor1.menu.new())
			await editor2.expectShapeCount(0) // New file should be empty
			await editor2.expectTitleToContain('Untitled')

			// First editor should retain its content
			await editor1.expectShapeCount(1)

			// Both should be open simultaneously
			expect(editor1.page.isClosed()).toBe(false)
			expect(editor2.page.isClosed()).toBe(false)
		})
	})

	test.describe('Recent Files', () => {
		test('shows saved file in recent files list', async ({ app, homePom }) => {
			// Verify no recent files initially
			await homePom.expectRecentFileCount(0)

			// Create and save a file
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.menu.save()
			await editor.expectTitleToContain(/test-/)

			// Close and verify recent file appears
			const home = await HomePOM.After(app, () => editor.close())
			await home.expectRecentFileCount(1)
			await expect(home.getRecentFile(/test-/)).toBeVisible({ timeout: 1000 })
		})

		test('opens file when clicking recent file entry', async ({ app, homePom }) => {
			// Create and save a file
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.menu.save()
			await editor.expectTitleToContain(/test-/)

			// Close and reopen from recents
			const home = await HomePOM.After(app, () => editor.close())
			await expect(home.getRecentFile(/test-/)).toBeVisible({ timeout: 1000 })

			const reopened = await EditorPOM.After(app, () => home.openRecentFile(/test-/))

			expect(reopened.page.url()).toContain('#/f/')
			await reopened.expectTitleToContain(/test-/)
		})

		test('preserves file content when reopening from recents', async ({ app, homePom }) => {
			// Create file with content
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.drawRectangle(100, 100, 50, 50)
			await editor.expectShapeCount(1)
			await editor.menu.save()
			await editor.expectTitleToContain(/test-/)

			// Close and reopen
			const home = await HomePOM.After(app, () => editor.close())
			await expect(home.getRecentFile(/test-/)).toBeVisible({ timeout: 1000 })

			const reopened = await EditorPOM.After(app, () => home.openRecentFile(/test-/))

			// Content should be preserved
			await reopened.expectShapeCount(1)
		})

		test('accumulates multiple saved files in recents list', async ({ app, homePom }) => {
			// Save first file
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.expectShapeCount(1)
			await editor1.menu.save()
			await editor1.expectTitleToContain(/test-/)
			const home2 = await HomePOM.After(app, () => editor1.close())

			// Verify first file is in recents
			await home2.expectRecentFileCount(1)

			// Save second file
			const editor2 = await EditorPOM.After(app, () => home2.newFile())
			await editor2.drawRectangle(200, 200)
			await editor2.expectShapeCount(1)
			await editor2.menu.save()
			await editor2.expectTitleToContain(/test-/)
			const home3 = await HomePOM.After(app, () => editor2.close())

			// Both files should appear in recents
			await home3.expectRecentFileCount(2)
		})

		test('orders recent files by last opened (most recent first)', async ({ app, homePom }) => {
			// Save file with 1 shape (opened first, will be older)
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.expectShapeCount(1)
			await editor1.menu.save()
			const home2 = await HomePOM.After(app, () => editor1.close())

			// Save file with 2 shapes (opened second, will be more recent)
			const editor2 = await EditorPOM.After(app, () => home2.newFile())
			await editor2.drawRectangle(100, 100)
			await editor2.drawRectangle(200, 200)
			await editor2.expectShapeCount(2)
			await editor2.menu.save()
			const home3 = await HomePOM.After(app, () => editor2.close())

			// Wait for recents to be populated
			await home3.expectRecentFileCount(2)

			// First recent file should be the most recent (2 shapes)
			const firstRecent = home3.getRecentFileButtons().first()
			await expect(firstRecent).toBeVisible({ timeout: 1000 })

			const opened = await EditorPOM.After(app, () => firstRecent.click())
			await opened.expectShapeCount(2)
		})

		test('does not duplicate file entry when re-saving same file', async ({ app, homePom }) => {
			// Create and save a file
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await editor.menu.save()
			await editor.expectTitleToContain(/test-/)

			// Make changes and save again
			await editor.drawRectangle(100, 100)
			await editor.expectShapeCount(1)
			await editor.menu.save()

			// Close and check recents
			const home = await HomePOM.After(app, () => editor.close())

			// Should still only have one recent file entry
			await home.expectRecentFileCount(1)
		})

		test('updates recents list when reopening existing file', async ({ app, homePom }) => {
			// Save two files
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.menu.save()
			const home2 = await HomePOM.After(app, () => editor1.close())

			const editor2 = await EditorPOM.After(app, () => home2.newFile())
			await editor2.drawRectangle(200, 200)
			await editor2.drawRectangle(300, 300)
			await editor2.menu.save()
			const home3 = await HomePOM.After(app, () => editor2.close())

			await home3.expectRecentFileCount(2)

			// First recent should be the file with 2 shapes (most recently closed)
			const firstBefore = home3.getRecentFileButtons().first()
			const firstOpened = await EditorPOM.After(app, () => firstBefore.click())
			await firstOpened.expectShapeCount(2)

			// Now open the older file (1 shape), making it the most recent
			const home4 = await HomePOM.After(app, () => firstOpened.close())
			await home4.expectRecentFileCount(2)

			// Reopen the file with 1 shape
			const secondButton = home4.getRecentFileButtons().last() // older file is now last
			const olderFileOpened = await EditorPOM.After(app, () => secondButton.click())
			await olderFileOpened.expectShapeCount(1)

			// Close and verify the 1-shape file is now first (most recent)
			const home5 = await HomePOM.After(app, () => olderFileOpened.close())
			await home5.expectRecentFileCount(2)

			const newFirst = home5.getRecentFileButtons().first()
			const verifyFile = await EditorPOM.After(app, () => newFirst.click())
			await verifyFile.expectShapeCount(1)
		})
	})
})
