import { EditorPOM } from 'e2e/poms/editor-pom'
import { HomePOM } from 'e2e/poms/home-pom'
import { setupTestFile } from 'e2e/setup-test'

const { test, expect } = setupTestFile()

/** Theme CSS selectors - used to verify theme application */
const THEME_SELECTORS = {
	light: '.tla-theme__light',
	dark: '.tla-theme__dark',
} as const

test.describe('File Menu', () => {
	test.describe('New File', () => {
		test('creates empty editor from home window via app menu', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.appMenu.file.new())
			await editor.expectTitleToContain('Untitled')
			await editor.expectShapeCount(0)
			await editor.expectCanvasVisible()
		})

		test('creates new editor from existing editor without affecting original', async ({
			app,
			homePom,
		}) => {
			// Create first editor with content
			const editor1 = await EditorPOM.After(app, () => homePom.newFile())
			await editor1.drawRectangle(100, 100)
			await editor1.expectShapeCount(1)

			// Create second editor from the first
			const editor2 = await EditorPOM.After(app, () => editor1.appMenu.file.new())
			await editor2.expectTitleToContain('Untitled')
			await editor2.expectShapeCount(0)

			// Verify original editor content is preserved
			await editor1.expectShapeCount(1)
		})

		test('supports creating multiple independent editor windows', async ({ app, homePom }) => {
			const editor1 = await EditorPOM.After(app, () => homePom.appMenu.file.new())
			const editor2 = await EditorPOM.After(app, () => editor1.appMenu.file.new())
			const editor3 = await EditorPOM.After(app, () => editor2.appMenu.file.new())

			// All editors should remain open
			expect(editor1.page.isClosed()).toBe(false)
			expect(editor2.page.isClosed()).toBe(false)
			expect(editor3.page.isClosed()).toBe(false)

			// Home window should be hidden when editors are open
			expect(await homePom.isHidden()).toBe(true)
		})
	})

	test.describe('Save File', () => {
		test('saves new file and updates title to filename', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.appMenu.file.new())
			await editor.expectTitleToContain('Untitled')
			await editor.appMenu.file.save()
			await editor.expectTitleToContain(/test-/)
		})

		test('persists content across close and reopen cycle', async ({ app, homePom }) => {
			// Create and save file with content
			const editor = await EditorPOM.After(app, () => homePom.appMenu.file.new())
			await editor.drawRectangle(200, 200, 80, 80)
			await editor.expectShapeCount(1)
			await editor.appMenu.file.save()
			await editor.expectTitleToContain(/test-/)

			// Close and reopen
			const home = await HomePOM.After(app, () => editor.appMenu.file.close())
			const reopenedEditor = await EditorPOM.After(app, () => home.openRecentFile(/test-/))

			// Verify content was persisted
			await reopenedEditor.expectShapeCount(1)
		})

		test('re-saves existing file without showing save dialog', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.appMenu.file.new())
			await editor.appMenu.file.save()
			await editor.expectTitleToContain(/test-/)

			// Capture the filename after first save
			const savedFilename = await editor.getTitleBar().textContent()

			// Make changes and save again
			await editor.drawRectangle(100, 100)
			await editor.expectShapeCount(1)
			await editor.appMenu.file.save()

			// Filename should remain the same (no new save dialog)
			const currentFilename = await editor.getTitleBar().textContent()
			expect(currentFilename).toBe(savedFilename)
		})
	})

	test.describe('Close', () => {
		test('closes the editor window', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.appMenu.file.new())
			await editor.appMenu.file.close()
			await expect.poll(() => editor.page.isClosed(), { timeout: 1000 }).toBe(true)
		})
	})

	test.describe('Home', () => {
		test('shows home window without closing the editor', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			expect(await homePom.isHidden()).toBe(true)

			// Add content to verify editor state is preserved
			await editor.drawRectangle(100, 100)
			await editor.expectShapeCount(1)

			await editor.appMenu.file.home()
			await expect
				.poll(() => homePom.isShowing(), {
					timeout: 1000,
					message: 'Home window should become visible',
				})
				.toBe(true)

			// Editor should remain open with content intact
			expect(editor.page.isClosed()).toBe(false)
			await editor.expectShapeCount(1)
		})
	})

	test.describe('Open', () => {
		test('opens previously saved file via File > Open', async ({ app, homePom }) => {
			// Create and save a file with content
			const editor1 = await EditorPOM.After(app, () => homePom.appMenu.file.new())
			await editor1.drawRectangle(100, 100)
			await editor1.expectShapeCount(1)
			await editor1.appMenu.file.save()
			await editor1.expectTitleToContain(/test-/)

			// Close and create a fresh editor
			const home = await HomePOM.After(app, () => editor1.appMenu.file.close())
			const editor2 = await EditorPOM.After(app, () => home.appMenu.file.new())

			// Open the previously saved file
			const openedEditor = await EditorPOM.After(app, () => editor2.appMenu.file.open())

			// Verify the opened file has the saved content
			await openedEditor.expectShapeCount(1)
			await openedEditor.expectTitleToContain(/test-/)
		})
	})

	test.describe('Preferences', () => {
		test('starts in light mode and toggles via app menu', async ({ homePom }) => {
			const lightTheme = homePom.page.locator(THEME_SELECTORS.light)
			const darkTheme = homePom.page.locator(THEME_SELECTORS.dark)

			// Starts in light mode
			await expect(lightTheme).toBeVisible()
			await expect(darkTheme).not.toBeVisible()

			// Toggle to dark
			await homePom.appMenu.file.preferences.theme()
			await expect(darkTheme).toBeVisible()
			await expect(lightTheme).not.toBeVisible()

			// Toggle back to light
			await homePom.appMenu.file.preferences.theme()
			await expect(lightTheme).toBeVisible()
			await expect(darkTheme).not.toBeVisible()
		})

		test('syncs theme between home and editor windows', async ({ app, homePom }) => {
			await homePom.appMenu.file.preferences.theme()
			await expect(homePom.page.locator(THEME_SELECTORS.dark)).toBeVisible()

			const editor = await EditorPOM.After(app, () => homePom.newFile())
			await expect(editor.page.locator(THEME_SELECTORS.dark)).toBeVisible()

			await editor.appMenu.file.preferences.theme()
			await expect(editor.page.locator(THEME_SELECTORS.light)).toBeVisible()

			const home = await HomePOM.After(app, () => editor.close())
			await expect(home.page.locator(THEME_SELECTORS.light)).toBeVisible()
		})
	})
})
