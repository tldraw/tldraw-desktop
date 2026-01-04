import { ConsoleMessage, ElectronApplication, expect, Page } from '@playwright/test'
import { sleep } from 'e2e/helpers'
import { clickMenuItemById } from 'electron-playwright-helpers'

/** Default timeout for waiting for windows to appear */
const DEFAULT_WINDOW_TIMEOUT = 10000

/** Platform-specific modifier key */
const MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control'

export class BasePOM {
	constructor(
		public readonly app: ElectronApplication,
		public readonly page: Page
	) {}

	private _closed = false

	get isClosed(): boolean {
		return this._closed
	}

	appMenu = {
		file: {
			new: () => clickMenuItemById(this.app, 'file-new'),
			open: () => clickMenuItemById(this.app, 'file-open'),
			openRecent: {
				/**
				 * Open a recent file by index (0-based).
				 * @param index - The index of the recent file to open (0 = most recent)
				 */
				byIndex: (index: number) => clickMenuItemById(this.app, `file-recent-${index}`),
				/**
				 * Clear all recent files from the menu.
				 */
				clear: () => clickMenuItemById(this.app, 'file-open-recent-clear'),
			},
			save: () => clickMenuItemById(this.app, 'file-save'),
			saveAs: () => clickMenuItemById(this.app, 'file-save-as'),
			rename: () => clickMenuItemById(this.app, 'file-rename'),
			home: () => clickMenuItemById(this.app, 'home'),
			close: () => clickMenuItemById(this.app, 'file-close'),
			preferences: {
				theme: () => clickMenuItemById(this.app, 'pref-theme'),
				snapMode: () => clickMenuItemById(this.app, 'pref-snap-mode'),
				toolLock: () => clickMenuItemById(this.app, 'pref-tool-lock'),
			},
			export: {
				svg: () => clickMenuItemById(this.app, 'export-svg'),
				png: () => clickMenuItemById(this.app, 'export-png'),
				copyAsSvg: () => clickMenuItemById(this.app, 'copy-as-svg'),
				copyAsPng: () => clickMenuItemById(this.app, 'copy-as-png'),
			},
		},
		edit: {
			undo: () => clickMenuItemById(this.app, 'edit-undo'),
			redo: () => clickMenuItemById(this.app, 'edit-redo'),
			cut: () => clickMenuItemById(this.app, 'edit-cut'),
			copy: () => clickMenuItemById(this.app, 'edit-copy'),
			paste: () => clickMenuItemById(this.app, 'edit-paste'),
			duplicate: () => clickMenuItemById(this.app, 'edit-duplicate'),
			delete: () => clickMenuItemById(this.app, 'edit-delete'),
			selectAll: () => clickMenuItemById(this.app, 'edit-select-all'),
			selectNone: () => clickMenuItemById(this.app, 'edit-select-none'),
			group: () => clickMenuItemById(this.app, 'edit-group'),
			ungroup: () => clickMenuItemById(this.app, 'edit-ungroup'),
			lock: () => clickMenuItemById(this.app, 'edit-lock'),
			unlockAll: () => clickMenuItemById(this.app, 'edit-unlock-all'),
		},
		arrange: {
			bringToFront: () => clickMenuItemById(this.app, 'arrange-bring-to-front'),
			bringForward: () => clickMenuItemById(this.app, 'arrange-bring-forward'),
			sendBackward: () => clickMenuItemById(this.app, 'arrange-send-backward'),
			sendToBack: () => clickMenuItemById(this.app, 'arrange-send-to-back'),
			flipHorizontal: () => clickMenuItemById(this.app, 'arrange-flip-h'),
			flipVertical: () => clickMenuItemById(this.app, 'arrange-flip-v'),
			rotateCw: () => clickMenuItemById(this.app, 'arrange-rotate-cw'),
			rotateCcw: () => clickMenuItemById(this.app, 'arrange-rotate-ccw'),
		},
		view: {
			zoomIn: () => clickMenuItemById(this.app, 'view-zoom-in'),
			zoomOut: () => clickMenuItemById(this.app, 'view-zoom-out'),
			zoomTo100: () => clickMenuItemById(this.app, 'view-zoom-100'),
			zoomToFit: () => clickMenuItemById(this.app, 'view-zoom-fit'),
			zoomToSelection: () => clickMenuItemById(this.app, 'view-zoom-selection'),
			grid: () => clickMenuItemById(this.app, 'view-grid'),
			focusMode: () => clickMenuItemById(this.app, 'view-focus-mode'),
			debugMode: () => clickMenuItemById(this.app, 'view-debug-mode'),
		},
		insert: {
			media: () => clickMenuItemById(this.app, 'insert-media'),
			embed: () => clickMenuItemById(this.app, 'insert-embed'),
		},
		help: {
			license: () => clickMenuItemById(this.app, 'help-license'),
			about: () =>
				// On macOS, About is in the app menu; on other platforms, it's in Help
				clickMenuItemById(this.app, 'app-about').catch(() =>
					clickMenuItemById(this.app, 'help-about')
				),
		},
	}

	kbds = {
		copy: async (contents?: string) => {
			if (contents) {
				await this.app.evaluate(
					({ clipboard }, contents) => clipboard.writeText(contents),
					contents
				)
			} else {
				await this.page.keyboard.press(`${MODIFIER}+C`)
			}
			await sleep(100)
		},

		copySvg: async () => {
			await this.page.keyboard.press(`${MODIFIER}+Shift+C`)
			await sleep(100)
		},

		paste: async () => {
			await this.page.keyboard.press(`${MODIFIER}+V`)
			await sleep(100)
		},

		// Note: Menu accelerators (Cmd/Ctrl+N, O, S, Shift+S) cannot be triggered via
		// Playwright's keyboard simulation because they are handled at the Electron
		// application level, not the renderer. Use clickMenuItemById instead.
		newFile: async () => {
			await clickMenuItemById(this.app, 'file-new')
		},

		openFile: async () => {
			await clickMenuItemById(this.app, 'file-open')
		},

		save: async () => {
			await clickMenuItemById(this.app, 'file-save')
		},

		saveAs: async () => {
			await clickMenuItemById(this.app, 'file-save-as')
		},

		undo: async () => {
			await this.page.keyboard.press(`${MODIFIER}+Z`)
		},

		redo: async () => {
			await this.page.keyboard.press(`${MODIFIER}+Shift+Z`)
		},

		selectAll: async () => {
			await this.page.keyboard.press(`${MODIFIER}+A`)
		},

		delete: async () => {
			await this.page.keyboard.press('Backspace')
		},
	}

	async waitForReady() {
		if (!(await this.page.getByTestId('app-container').isVisible())) {
			await this.page.waitForSelector('.tla', { state: 'visible' })
		}
	}

	async getWindowBounds() {
		const url = this.page.url()
		return await this.app.evaluate(
			({ BrowserWindow }, { url }) => {
				const windows = BrowserWindow.getAllWindows()
				const window = windows.find((w) => w.webContents.getURL() === url)
				if (!window) throw new Error(`Window with URL "${url}" not found`)
				return window.getBounds()
			},
			{ url }
		)
	}

	async setWindowBounds(bounds: { x: number; y: number; width: number; height: number }) {
		const url = this.page.url()
		await this.app.evaluate(
			({ BrowserWindow }, { bounds, url }) => {
				const windows = BrowserWindow.getAllWindows()
				const window = windows.find((w) => w.webContents.getURL() === url)
				if (!window) throw new Error(`Window with URL "${url}" not found`)
				window.setBounds(bounds, false)
			},
			{ bounds, url }
		)
	}

	async expectTitleToContain(text: string | RegExp) {
		await expect(this.page.getByTestId('editor__titlebar__title')).toContainText(text)
	}

	getRecentFile(text: string | RegExp) {
		return this.page.getByRole('button', { name: text })
	}

	async openRecentFile(text: string | RegExp) {
		await this.getRecentFile(text).click()
	}

	async evaluate<T>(fn: (...args: any[]) => T, args: any[] = []) {
		return await this.page.evaluate(fn, args)
	}

	async cancelShortcut() {
		await this.page.keyboard.press('Escape')
	}

	async close() {
		await this.page.close()
		this._closed = true
	}

	protected markClosed() {
		this._closed = true
	}

	/**
	 * Check if the window is currently visible.
	 * @returns true if visible, false if hidden, null if window not found
	 */
	async isShowing(): Promise<boolean | null> {
		const url = this.page.url()
		return await this.app.evaluate(
			({ BrowserWindow }, { url }) => {
				const windows = BrowserWindow.getAllWindows()
				const window = windows.find((w) => w.webContents.getURL() === url)
				if (!window) return null
				return window.isVisible()
			},
			{ url }
		)
	}

	async isHidden(): Promise<boolean> {
		const showing = await this.isShowing()
		return showing === false || showing === null
	}

	/**
	 * Check if the window is focused.
	 */
	async isFocused(): Promise<boolean | null> {
		const url = this.page.url()
		return await this.app.evaluate(
			({ BrowserWindow }, { url }) => {
				const windows = BrowserWindow.getAllWindows()
				const window = windows.find((w) => w.webContents.getURL() === url)
				if (!window) return null
				return window.isFocused()
			},
			{ url }
		)
	}

	/**
	 * Focus this window.
	 */
	async focus(): Promise<void> {
		const url = this.page.url()
		await this.app.evaluate(
			({ BrowserWindow }, { url }) => {
				const windows = BrowserWindow.getAllWindows()
				const window = windows.find((w) => w.webContents.getURL() === url)
				if (window) {
					window.focus()
				}
			},
			{ url }
		)
	}

	/**
	 * Wait for a new window to open after executing a callback.
	 * Listens for a specific console message that indicates the window is ready.
	 *
	 * @param app - The Electron application instance
	 * @param consoleMessage - The console message to wait for (e.g., 'about-window-show')
	 * @param urlContains - String that the window URL should contain (e.g., '/about')
	 * @param cb - Callback that triggers the window to open
	 * @param timeout - Timeout in milliseconds (default: 10000)
	 * @returns Promise that resolves to the new window's Page
	 */
	protected static async waitForWindowWithConsoleMessage(
		app: ElectronApplication,
		consoleMessage: string,
		urlContains: string,
		cb: () => unknown | Promise<unknown>,
		timeout = DEFAULT_WINDOW_TIMEOUT
	): Promise<Page> {
		// Track existing windows before the callback to identify new ones
		// Store both URL and page reference to handle URL changes
		const existingWindowIds = new Set(app.windows().map((w) => w.url()))
		const windowCountBefore = app.windows().length

		return new Promise<Page>((resolve, reject) => {
			let resolved = false

			const timeoutId = setTimeout(() => {
				if (resolved) return
				cleanup()
				const availableWindows = app
					.windows()
					.map((w) => w.url())
					.join(', ')
				reject(
					new Error(
						`Timeout waiting for window with console message "${consoleMessage}" after ${timeout}ms. ` +
							`Expected URL to contain "${urlContains}". Available windows: [${availableWindows}]`
					)
				)
			}, timeout)

			function cleanup() {
				clearTimeout(timeoutId)
				app.off('console', handleConsole)
			}

			async function handleConsole(message: ConsoleMessage) {
				if (resolved) return
				if (message.text() === consoleMessage) {
					// Poll for the window - URL change may not be immediate
					// (loadUrlInWindow is async and may not complete before console.log)
					const pollInterval = 50
					const pollTimeout = 3000
					const startTime = Date.now()

					const pollForWindow = async (): Promise<Page | null> => {
						while (Date.now() - startTime < pollTimeout) {
							const windows = app.windows()
							const matchingWindows = windows.filter((w) => w.url().includes(urlContains))

							// Strategy 1: Look for a completely new window (window count increased)
							if (windows.length > windowCountBefore) {
								const newWin = matchingWindows.find((w) => !existingWindowIds.has(w.url()))
								if (newWin) return newWin
							}

							// Strategy 2: Look for a window with a new URL (preloaded window repurposed)
							const changedWin = matchingWindows.find((w) => !existingWindowIds.has(w.url()))
							if (changedWin) return changedWin

							// Strategy 3: Accept any matching window (e.g., home reappearing)
							if (matchingWindows.length > 0) {
								// For "show" events, the window already existed
								return matchingWindows[0]
							}

							await sleep(pollInterval)
						}
						return null
					}

					const win = await pollForWindow()
					if (!win) {
						if (resolved) return
						cleanup()
						const availableWindows = app
							.windows()
							.map((w) => w.url())
							.join(', ')
						reject(
							new Error(
								`Console message "${consoleMessage}" received but window with URL containing "${urlContains}" not found. ` +
									`Available windows: [${availableWindows}]`
							)
						)
						return
					}
					if (resolved) return
					resolved = true
					cleanup()
					// Small delay to ensure window is fully ready
					await sleep(100)
					resolve(win)
				}
			}

			app.on('console', handleConsole)
			Promise.resolve(cb()).catch((err) => {
				if (resolved) return
				cleanup()
				reject(err)
			})
		})
	}
}
