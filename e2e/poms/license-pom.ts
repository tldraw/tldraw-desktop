import { ElectronApplication, expect } from '@playwright/test'
import { BasePOM } from './base-pom'

/** Console message emitted when the license window is shown */
const LICENSE_WINDOW_CONSOLE_MESSAGE = 'license-window-show'

/** Default timeout for scroll operations */
const SCROLL_TIMEOUT = 2000

export class LicensePOM extends BasePOM {
	// ============ Locators ============

	getContainer() {
		return this.page.locator('.license__layout')
	}

	getHeader() {
		return this.page.locator('.editor__titlebar')
	}

	getContent() {
		return this.page.locator('.license__content')
	}

	getSection(name: string) {
		return this.page.locator('.license__section', { hasText: name })
	}

	/**
	 * Get a section by exact h2 heading text (useful for avoiding partial matches)
	 */
	getExactSection(name: string) {
		return this.page.locator('.license__section').filter({
			has: this.page.locator('h2', { hasText: name }),
		})
	}

	getAllSections() {
		return this.page.locator('.license__section')
	}

	// ============ Actions ============

	/** Get the count of license sections */
	async getSectionCount(): Promise<number> {
		return await this.getAllSections().count()
	}

	/** Scroll the content area to the bottom */
	async scrollToBottom(): Promise<void> {
		const content = this.getContent()
		await content.evaluate((el) => el.scrollTo(0, el.scrollHeight))
	}

	/** Scroll the content area to the top */
	async scrollToTop(): Promise<void> {
		const content = this.getContent()
		await content.evaluate((el) => el.scrollTo(0, 0))
	}

	/** Get the current scroll position of the content area */
	async getScrollPosition(): Promise<number> {
		return await this.getContent().evaluate((el) => el.scrollTop)
	}

	// ============ Assertions ============

	async expectSectionVisible(name: string) {
		await expect(this.getSection(name)).toBeVisible()
	}

	/**
	 * Expect a section with an exact h2 heading to be visible
	 */
	async expectExactSectionVisible(name: string) {
		await expect(this.getExactSection(name)).toBeVisible()
	}

	async expectToContainText(text: string) {
		await expect(this.getContent()).toContainText(text)
	}

	/** Assert that the content area is visible */
	async expectContentVisible(): Promise<void> {
		await expect(this.getContent()).toBeVisible()
	}

	/** Assert that the content area has scrollable overflow */
	async expectContentScrollable(): Promise<void> {
		const overflow = await this.getContent().evaluate((el) => getComputedStyle(el).overflowY)
		expect(overflow).toBe('auto')
	}

	/** Assert the scroll position matches expected value */
	async expectScrollPosition(expected: number, timeout = SCROLL_TIMEOUT): Promise<void> {
		await expect
			.poll(() => this.getScrollPosition(), {
				timeout,
				message: `Expected scroll position to be ${expected}`,
			})
			.toBe(expected)
	}

	/** Assert the expected number of license sections */
	async expectSectionCount(count: number, timeout = 1000): Promise<void> {
		await expect(this.getAllSections()).toHaveCount(count, { timeout })
	}

	/**
	 * Wait for the License window to open after executing a callback.
	 * @param app - The Electron application instance
	 * @param cb - Callback that triggers the License window to open
	 * @param timeout - Optional timeout in milliseconds
	 */
	static async After(
		app: ElectronApplication,
		cb: () => unknown | Promise<unknown>,
		timeout?: number
	): Promise<LicensePOM> {
		const page = await BasePOM.waitForWindowWithConsoleMessage(
			app,
			LICENSE_WINDOW_CONSOLE_MESSAGE,
			'/license',
			cb,
			timeout
		)

		const pom = new LicensePOM(app, page)
		await pom.waitForReady()
		return pom
	}
}
