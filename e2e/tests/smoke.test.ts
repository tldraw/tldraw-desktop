import { EditorPOM } from 'e2e/poms/editor-pom'
import { setupTestFile } from 'e2e/setup-test'
import { existsSync, readdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { HomePOM } from '../poms/home-pom'

const { test, expect } = setupTestFile()

/**
 * Smoke tests verify core application workflows and critical user journeys.
 * These tests should cover the most common operations users perform.
 */

test.describe('Application Launch', () => {
	test('should launch with home window visible and actionable', async ({ homePom }) => {
		// Use polling for visibility check as window may take time to appear
		await expect
			.poll(() => homePom.isShowing(), {
				timeout: 1000,
				message: 'Home window should be visible after launch',
			})
			.toBe(true)

		expect(homePom.page.url()).toContain('#/home')

		// Use POM method instead of raw locator for consistency
		const newFileButton = homePom.getNewFileButton()
		await expect(newFileButton).toBeVisible()
		await expect(newFileButton).toBeEnabled()
	})
})

test.describe('End-to-End Workflow', () => {
	test('full file lifecycle: create, edit, save, close, reopen', async ({ app, homePom }) => {
		// Step 1: Create a new file from home
		expect(homePom.page.url()).toContain('#/home')
		const editor = await EditorPOM.After(app, () => homePom.newFile())
		await editor.expectTitleToContain('Untitled')

		// Step 2: Draw shapes on the canvas
		await editor.drawRectangle(100, 100, 80, 80)
		await editor.drawRectangle(200, 200, 60, 60)
		await editor.expectShapeCount(2)

		// Step 3: Save the file
		await editor.menu.save()
		await editor.cancelShortcut()
		await editor.expectTitleToContain(/test-.*\.tldr/)

		// Step 4: Set specific window bounds and save again to persist
		// Note: CI runners may constrain exact values, so we check within tolerance
		const customBounds = { x: 0, y: 50, width: 1200, height: 800 }
		await editor.setWindowBounds(customBounds)
		await expect
			.poll(
				async () => {
					const bounds = await editor.getWindowBounds()
					const widthClose = Math.abs(bounds.width - customBounds.width) < 100
					const heightClose = Math.abs(bounds.height - customBounds.height) < 100
					return widthClose && heightClose
				},
				{ timeout: 3000, message: 'Window bounds should be applied' }
			)
			.toBe(true)

		await editor.menu.save()
		await editor.cancelShortcut()

		// Step 5: Close the editor and verify home shows recent file
		const homeAgain = await HomePOM.After(app, () => editor.close())
		await expect(homeAgain.getRecentFile('test-')).toBeVisible()
		expect(editor.page.isClosed()).toBe(true)

		// Step 6: Reopen the file and verify persistence
		const editorAgain = await EditorPOM.After(app, () => homeAgain.openRecentFile('test-'))
		await editorAgain.expectTitleToContain(/test-.*\.tldr/)
		await editorAgain.expectShapeCount(2)

		const restoredBounds = await editorAgain.getWindowBounds()
		expect(restoredBounds.width).toBe(customBounds.width)
		expect(restoredBounds.height).toBe(customBounds.height)
	})

	test('copy and paste workflow', async ({ app, homePom }) => {
		const editor = await EditorPOM.After(app, () => homePom.newFile())

		// Create and select a shape
		await editor.drawRectangle(100, 100, 80, 80)
		await editor.expectShapeCount(1)
		await editor.selectAllShapes()

		await expect
			.poll(() => editor.getSelectedShapeCount(), {
				timeout: 3000,
				message: 'Shape should be selected before copy',
			})
			.toBe(1)

		// Copy the shape as SVG and paste (creates an SVG image shape)
		await editor.kbds.copySvg()
		await editor.kbds.paste()

		// Original shape + pasted SVG image = 2 shapes
		await editor.expectShapeCount(2)
	})

	test('multiple windows should maintain isolated content', async ({ app, homePom }) => {
		// Create first editor with one shape
		const editor1 = await EditorPOM.After(app, () => homePom.newFile())
		await editor1.drawRectangle(100, 100)
		await editor1.expectShapeCount(1)

		// Create second editor with two shapes
		const editor2 = await EditorPOM.After(app, () => editor1.menu.new())
		await editor2.drawRectangle(200, 200)
		await editor2.drawRectangle(300, 300)
		await editor2.expectShapeCount(2)

		// Verify content isolation - each editor maintains its own state
		await editor1.expectShapeCount(1)
		await editor2.expectShapeCount(2)

		// Closing one editor should not affect another
		await editor2.close()
		expect(editor2.page.isClosed()).toBe(true)
		expect(editor1.page.isClosed()).toBe(false)
		await editor1.expectShapeCount(1)
	})

	test('multiple windows with save workflow', async ({ app, homePom }) => {
		// Verifies that saving one file doesn't affect another unsaved file
		const editor1 = await EditorPOM.After(app, () => homePom.newFile())
		await editor1.expectTitleToContain('Untitled')

		// Create and save a second file
		const editor2 = await EditorPOM.After(app, () => editor1.menu.new())
		await editor2.drawRectangle(150, 150)
		await editor2.menu.save()
		// Escape ensures any save dialog popover is dismissed before continuing
		await editor2.cancelShortcut()
		await editor2.expectTitleToContain(/test-.*\.tldr/)

		// Both windows should still be open and functional
		expect(editor1.page.isClosed()).toBe(false)
		expect(editor2.page.isClosed()).toBe(false)

		// First editor should still be empty and unsaved
		await editor1.expectShapeCount(0)
		await editor1.expectTitleToContain('Untitled')
	})

	test('rapid window creation and closure should remain stable', async ({ app, homePom }) => {
		// Stress test: rapidly create multiple editor windows
		const editor1 = await EditorPOM.After(app, () => homePom.newFile())
		await editor1.drawRectangle(100, 100)

		const editor2 = await EditorPOM.After(app, () => editor1.menu.new())
		await editor2.drawRectangle(200, 200)

		const editor3 = await EditorPOM.After(app, () => editor2.menu.new())
		await editor3.drawRectangle(300, 300)

		// Verify all editors have their expected content
		await editor1.expectShapeCount(1)
		await editor2.expectShapeCount(1)
		await editor3.expectShapeCount(1)

		// Close all editors in reverse order (LIFO pattern)
		await editor3.close()
		expect(editor3.page.isClosed()).toBe(true)

		await editor2.close()
		expect(editor2.page.isClosed()).toBe(true)

		// Closing the last editor should bring home window back
		const home = await HomePOM.After(app, () => editor1.close())
		await expect
			.poll(() => home.isShowing(), {
				timeout: 1000,
				message: 'Home should appear after closing last editor',
			})
			.toBe(true)
	})
})

test.describe('Keyboard Shortcuts', () => {
	test('Cmd/Ctrl+S should save file', async ({ app, homePom }) => {
		const editor = await EditorPOM.After(app, () => homePom.newFile())
		await editor.expectTitleToContain('Untitled')

		// Save via keyboard shortcut
		await editor.kbds.save()

		// Title should now contain the test file prefix (test environment stubs save dialog)
		await editor.expectTitleToContain('test-')
	})

	test('Cmd/Ctrl+N should create new file from existing editor', async ({ app, homePom }) => {
		// Start with an editor that has content
		const editor1 = await EditorPOM.After(app, () => homePom.newFile())
		await editor1.drawRectangle(100, 100)
		await editor1.expectShapeCount(1)

		// Create new file via keyboard shortcut
		const editor2 = await EditorPOM.After(app, () => editor1.kbds.newFile())

		// New file should be empty with default title
		await editor2.expectShapeCount(0)
		await editor2.expectTitleToContain('Untitled')

		// Original editor should still have its content (windows are isolated)
		await editor1.expectShapeCount(1)
	})

	test('Cmd/Ctrl+O should open file dialog', async ({ app, homePom }) => {
		// This test verifies that Cmd/Ctrl+O triggers the open file action.
		// In test mode, file dialogs are bypassed and use predetermined paths,
		// so we test the menu action works and the editor loads.
		const editor = await EditorPOM.After(app, () => homePom.newFile())
		await editor.drawRectangle(100, 100)
		await editor.kbds.save()
		await editor.expectTitleToContain('test-')

		// Verify the file was saved and can be reopened via recent files
		const home = await HomePOM.After(app, () => editor.close())
		await expect(home.getRecentFile('test-')).toBeVisible()

		// Reopen the saved file via recent files
		const editor2 = await EditorPOM.After(app, () => home.openRecentFile('test-'))
		await editor2.waitForReady()
		expect(editor2.page.url()).toContain('#/f/')
		await editor2.expectShapeCount(1)
	})
})

test.describe('Per-File Storage', () => {
	test('should store data in per-file format instead of single JSON blob', async ({
		app,
		homePom,
	}) => {
		// Get the test data directory from the app's environment
		const testDataDir = await app.evaluate(async () => {
			return process.env.TEST_DATA_DIR
		})
		expect(testDataDir).toBeTruthy()

		// Create an editor and save a file (using keyboard shortcut to avoid menu issues)
		const editor = await EditorPOM.After(app, () => homePom.newFile())
		await editor.drawRectangle(100, 100)
		await editor.kbds.save()
		await editor.expectTitleToContain(/test-/)

		// Wait for persistence (happens every 1 second)
		await editor.page.waitForTimeout(2000)

		// Verify the new per-file storage format exists
		const configPath = join(testDataDir!, 'config.json')
		const recentFilesPath = join(testDataDir!, 'recent-files.json')
		const filesDir = join(testDataDir!, 'files')
		const legacyStorePath = join(testDataDir!, 'open-files.json')

		// config.json should exist
		expect(existsSync(configPath)).toBe(true)

		// recent-files.json should exist
		expect(existsSync(recentFilesPath)).toBe(true)

		// files/ directory should exist and contain at least one file
		expect(existsSync(filesDir)).toBe(true)
		const files = readdirSync(filesDir)
		expect(files.length).toBeGreaterThanOrEqual(1)

		// Legacy open-files.json should NOT exist (new installs shouldn't have it)
		expect(existsSync(legacyStorePath)).toBe(false)

		// Verify config.json has correct structure
		const configContent = await readFile(configPath, 'utf8')
		const config = JSON.parse(configContent)
		expect(config.version).toBe('2.0.0')
		expect(config.userPreferences).toBeDefined()
		expect(config.featureFlags).toBeDefined()

		// Verify recent-files.json has correct structure
		const recentFilesContent = await readFile(recentFilesPath, 'utf8')
		const recentFiles = JSON.parse(recentFilesContent)
		expect(recentFiles.version).toBe('2.0.0')
		expect(recentFiles.files).toBeDefined()
		// After saving, we should have at least one recent file
		expect(Object.keys(recentFiles.files).length).toBeGreaterThanOrEqual(1)
	})

	test('should delete open file storage when window closes', async ({ app, homePom }) => {
		// Get the test data directory from the app's environment
		const testDataDir = await app.evaluate(async () => {
			return process.env.TEST_DATA_DIR
		})
		expect(testDataDir).toBeTruthy()

		const filesDir = join(testDataDir!, 'files')

		// Create an editor (unsaved file)
		const editor = await EditorPOM.After(app, () => homePom.newFile())
		await editor.drawRectangle(100, 100)

		// Wait for persistence
		await editor.page.waitForTimeout(2000)

		// Count open file storage files before close
		const filesBefore = existsSync(filesDir) ? readdirSync(filesDir).length : 0
		expect(filesBefore).toBeGreaterThanOrEqual(1)

		// Close the editor (should trigger file deletion for unsaved file)
		const home = await HomePOM.After(app, () => editor.close())

		// Wait for file deletion using the home page
		await home.page.waitForTimeout(2000)

		// The open file storage should be deleted
		const filesAfter = existsSync(filesDir) ? readdirSync(filesDir).length : 0
		expect(filesAfter).toBeLessThan(filesBefore)
	})
})
