import { ElectronApplication, Page } from '@playwright/test'
import { stubDialog } from 'electron-playwright-helpers'

/**
 * Delay execution for a specified duration.
 *
 * WARNING: Avoid using this in tests. Prefer:
 * - `expect.poll()` for waiting on conditions
 * - `page.waitForSelector()` for DOM elements
 * - `page.waitForFunction()` for arbitrary conditions
 *
 * This function should only be used:
 * - After clipboard operations (copy/paste) where timing is unpredictable
 * - As a last resort when no better synchronization is available
 *
 * @param ms - Duration in milliseconds
 */
export async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Stub the native file open dialog to return specified file paths.
 * Call this BEFORE triggering the open dialog action.
 * @param app - The Electron application instance
 * @param filePaths - Array of file paths to return from the dialog
 */
export async function stubOpenDialog(app: ElectronApplication, filePaths: string[]): Promise<void> {
	await stubDialog(app, 'showOpenDialog', { filePaths })
}

/**
 * Stub the native file save dialog to return a specified file path.
 * Call this BEFORE triggering the save dialog action.
 * @param app - The Electron application instance
 * @param filePath - The file path to return from the dialog
 */
export async function stubSaveDialog(app: ElectronApplication, filePath: string): Promise<void> {
	await stubDialog(app, 'showSaveDialog', { filePath })
}

/**
 * Stub a message box dialog (e.g., confirmation dialogs).
 * @param app - The Electron application instance
 * @param response - The button index to "click" (0 = first button)
 */
export async function stubMessageBox(app: ElectronApplication, response: number): Promise<void> {
	await stubDialog(app, 'showMessageBox', { response })
}

/**
 * Wait for a condition to be true, polling at regular intervals.
 * Use this for custom wait conditions not covered by Playwright's built-in waits.
 * @param condition - Function that returns a boolean or Promise<boolean>
 * @param timeout - Maximum time to wait in milliseconds (default: 1000)
 * @param interval - Polling interval in milliseconds (default: 100)
 * @param message - Error message if condition times out
 */
export async function waitFor(
	condition: () => boolean | Promise<boolean>,
	timeout = 1000,
	interval = 100,
	message = 'Condition not met within timeout'
): Promise<void> {
	const startTime = Date.now()
	while (Date.now() - startTime < timeout) {
		if (await condition()) {
			return
		}
		await sleep(interval)
	}
	throw new Error(message)
}

/**
 * Get only visible windows from the app, excluding hidden windows like
 * the preloaded editor window or hidden home window.
 * @param app - The Electron application instance
 * @returns Array of visible Page objects
 */
export async function getVisibleWindows(app: ElectronApplication): Promise<Page[]> {
	const allWindows = app.windows()
	const visibleWindows: Page[] = []

	for (const win of allWindows) {
		const isVisible = await app.evaluate(
			({ BrowserWindow }, { url }) => {
				const windows = BrowserWindow.getAllWindows()
				const window = windows.find((w) => w.webContents.getURL() === url)
				return window?.isVisible() ?? false
			},
			{ url: win.url() }
		)
		if (isVisible) {
			visibleWindows.push(win)
		}
	}

	return visibleWindows
}

/**
 * Get count of visible windows, excluding hidden windows like
 * the preloaded editor window or hidden home window.
 * @param app - The Electron application instance
 * @returns Number of visible windows
 */
export async function getVisibleWindowCount(app: ElectronApplication): Promise<number> {
	const windows = await getVisibleWindows(app)
	return windows.length
}

/**
 * Reset shared renderer atoms (filePathAtom, unsavedChangesAtom) to defaults.
 * Call this on a page to clear dirty state from previous operations.
 * @param page - The page to reset atoms on
 */
export async function resetSharedAtoms(page: Page): Promise<void> {
	await page.evaluate(() => {
		;(window as any).resetSharedAtoms?.()
	})
}
