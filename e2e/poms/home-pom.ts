import { ElectronApplication, expect } from '@playwright/test'
import { BasePOM } from './base-pom'

/** Console message emitted when the home window is shown */
const HOME_WINDOW_CONSOLE_MESSAGE = 'home-window-show'

/**
 * Page Object Model for the Home screen.
 * The home screen displays the file picker and recent files list.
 */
export class HomePOM extends BasePOM {
	// ============ Locators ============

	/** Get the New File button element */
	getNewFileButton() {
		return this.page.getByRole('button', { name: 'New File' })
	}

	/** Get all recent file buttons (files ending in .tldr) */
	getRecentFileButtons() {
		return this.page.getByRole('button', { name: /\.tldr$/ })
	}

	/** Get all untitled (unsaved) file buttons */
	getUntitledFileButtons() {
		return this.page.getByRole('button', { name: /untitled/i })
	}

	/** Get the logo element */
	getLogo() {
		return this.page.locator('.home__logo')
	}

	/** Get the app container */
	getAppContainer() {
		return this.page.locator('.tla')
	}

	// ============ Actions ============

	/** Click the New File button to create a new editor window */
	async newFile(): Promise<void> {
		await this.getNewFileButton().click()
	}

	// ============ Queries ============

	/** Get the count of recent files displayed */
	async getRecentFileCount(): Promise<number> {
		return await this.getRecentFileButtons().count()
	}

	/** Get the count of untitled (unsaved) files displayed */
	async getUntitledFileCount(): Promise<number> {
		return await this.getUntitledFileButtons().count()
	}

	/** Check if the home page has any recent files */
	async hasRecentFiles(): Promise<boolean> {
		return (await this.getRecentFileCount()) > 0
	}

	/** Check if the home page has any untitled files */
	async hasUntitledFiles(): Promise<boolean> {
		return (await this.getUntitledFileCount()) > 0
	}

	// ============ Assertions ============

	/** Assert that the home page is fully loaded and visible */
	async expectHomeVisible(): Promise<void> {
		await expect(this.getLogo()).toBeVisible()
		await expect(this.getNewFileButton()).toBeVisible()
		await expect(this.getAppContainer()).toBeVisible()
	}

	/** Assert that the New File button is enabled and clickable */
	async expectNewFileButtonEnabled(): Promise<void> {
		await expect(this.getNewFileButton()).toBeEnabled()
	}

	/** Assert the New File button is visible and enabled */
	async expectNewFileButtonReady(): Promise<void> {
		const button = this.getNewFileButton()
		await expect(button).toBeVisible()
		await expect(button).toBeEnabled()
	}

	/**
	 * Assert the expected number of recent files.
	 * Uses polling for reliability after file operations.
	 */
	async expectRecentFileCount(count: number, timeout = 1000): Promise<void> {
		await expect
			.poll(() => this.getRecentFileCount(), {
				timeout,
				message: `Expected ${count} recent files`,
			})
			.toBe(count)
	}

	/**
	 * Assert that a recent file matching the pattern exists.
	 * Uses polling for reliability after save operations.
	 */
	async expectRecentFileExists(pattern: string | RegExp, timeout = 1000): Promise<void> {
		await expect
			.poll(
				async () => {
					const button = this.getRecentFile(pattern)
					return await button.isVisible().catch(() => false)
				},
				{
					timeout,
					message: `Expected recent file matching "${pattern}" to exist`,
				}
			)
			.toBe(true)
	}

	/**
	 * Assert that the home window is visible.
	 * Uses polling for reliability as visibility may change asynchronously.
	 */
	async expectWindowVisible(timeout = 1000, message?: string): Promise<void> {
		await expect
			.poll(() => this.isShowing(), {
				timeout,
				message: message ?? 'Home window should be visible',
			})
			.toBe(true)
	}

	/**
	 * Assert that the home window is hidden.
	 * Uses polling for reliability as visibility may change asynchronously.
	 */
	async expectWindowHidden(timeout = 1000, message?: string): Promise<void> {
		await expect
			.poll(() => this.isHidden(), {
				timeout,
				message: message ?? 'Home window should be hidden',
			})
			.toBe(true)
	}

	/**
	 * Wait for the Home window to open after executing a callback.
	 * @param app - The Electron application instance
	 * @param cb - Callback that triggers the Home window to open
	 * @param timeout - Optional timeout in milliseconds
	 */
	static async After(
		app: ElectronApplication,
		cb: () => unknown | Promise<unknown>,
		timeout?: number
	): Promise<HomePOM> {
		const page = await BasePOM.waitForWindowWithConsoleMessage(
			app,
			HOME_WINDOW_CONSOLE_MESSAGE,
			'/home',
			cb,
			timeout
		)

		const pom = new HomePOM(app, page)
		await pom.waitForReady()
		return pom
	}
}
