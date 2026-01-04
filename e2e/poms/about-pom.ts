import { ElectronApplication, expect } from '@playwright/test'
import { BasePOM } from './base-pom'

/** Console message emitted when the about window is shown */
const ABOUT_WINDOW_CONSOLE_MESSAGE = 'about-window-show'

export class AboutPOM extends BasePOM {
	// ============ Locators ============

	/** Get the main layout container */
	getLayout() {
		return this.page.locator('.about__layout')
	}

	/** Get the hero section containing logo and version */
	getHero() {
		return this.page.locator('.about__hero')
	}

	/** Get the logo element (note: uses .home__logo class shared with home page) */
	getLogo() {
		return this.page.locator('.home__logo')
	}

	getVersion() {
		return this.page.locator('.about__version')
	}

	getContent() {
		return this.page.locator('.about__content')
	}

	getFooter() {
		return this.page.locator('.about__footer')
	}

	getFooterLink() {
		return this.page.locator('.about__footer a')
	}

	getSection(name: string) {
		return this.page.locator('.about__section', { hasText: name })
	}

	getDescription() {
		return this.page.locator('.about__description')
	}

	getDescriptionLink(text: string) {
		return this.page.locator('.about__description a', { hasText: text })
	}

	// ============ Assertions ============

	async expectLogoVisible() {
		await expect(this.getLogo()).toBeVisible()
	}

	async expectVersionVisible() {
		await expect(this.getVersion()).toBeVisible()
	}

	/** Assert the main layout is visible (basic page load verification) */
	async expectLayoutVisible() {
		await expect(this.getLayout()).toBeVisible()
	}

	async expectVersionMatches(pattern: RegExp) {
		await expect(this.getVersion()).toHaveText(pattern)
	}

	async expectToContainText(text: string) {
		await expect(this.getContent()).toContainText(text)
	}

	async expectFooterToContainText(text: string) {
		await expect(this.getFooter()).toContainText(text)
	}

	async expectFooterLinkHref(expectedHref: string) {
		await expect(this.getFooterLink()).toHaveAttribute('href', expectedHref)
	}

	async expectFooterLinkOpensInNewTab() {
		await expect(this.getFooterLink()).toHaveAttribute('target', '_blank')
		await expect(this.getFooterLink()).toHaveAttribute('rel', /noopener/)
	}

	async expectDescriptionLinkHref(linkText: string, expectedHref: string) {
		const link = this.getDescriptionLink(linkText)
		await expect(link).toHaveAttribute('href', expectedHref)
	}

	async expectDescriptionLinkOpensInNewTab(linkText: string) {
		const link = this.getDescriptionLink(linkText)
		await expect(link).toHaveAttribute('target', '_blank')
		await expect(link).toHaveAttribute('rel', /noopener/)
	}

	// ============ Actions ============

	async getVersionText(): Promise<string> {
		return (await this.getVersion().textContent()) || ''
	}

	// ============ Static Factory ============

	/**
	 * Wait for the About window to open after executing a callback.
	 * @param app - The Electron application instance
	 * @param cb - Callback that triggers the About window to open
	 * @param timeout - Optional timeout in milliseconds
	 */
	static async After(
		app: ElectronApplication,
		cb: () => unknown | Promise<unknown>,
		timeout?: number
	): Promise<AboutPOM> {
		const page = await BasePOM.waitForWindowWithConsoleMessage(
			app,
			ABOUT_WINDOW_CONSOLE_MESSAGE,
			'/about',
			cb,
			timeout
		)

		const pom = new AboutPOM(app, page)
		await pom.waitForReady()
		return pom
	}
}
