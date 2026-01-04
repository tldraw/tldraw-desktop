import { is } from '@electron-toolkit/utils'
import { BrowserWindow, dialog, screen, shell } from 'electron'
import { join } from 'path'
import { FileData, OpenFileData } from 'src/types'
import { StoreSnapshot, TLRecord } from 'tldraw'
import icon from '../../resources/icon.png?asset'
import { MainManager } from './MainManager'

export class WindowManager {
	windows: Record<number, BrowserWindow> = {}
	disposals: Record<number, () => void> = {}
	windowReadyPromises: Record<number, Promise<void>> = {}

	homeWindow = {} as BrowserWindow
	showingHomeWindow = false

	licenseWindow: BrowserWindow | null = null
	aboutWindow: BrowserWindow | null = null

	preloadedEditorWindow = null as null | BrowserWindow

	private homeWindowCheckTimeout: NodeJS.Timeout | null = null

	// Disable preloaded window optimization during e2e tests to avoid race conditions
	private isPlaywrightTest: boolean

	constructor(public mainManager: MainManager) {
		this.isPlaywrightTest = process.argv.includes('--playwright')
	}

	/**
	 * Schedules a check to show the home window after a small delay.
	 * This debounces rapid window close events to prevent race conditions
	 * when multiple editor windows are closed in quick succession.
	 */
	private scheduleHomeWindowCheck() {
		if (this.homeWindowCheckTimeout) {
			clearTimeout(this.homeWindowCheckTimeout)
		}
		this.homeWindowCheckTimeout = setTimeout(() => {
			this.homeWindowCheckTimeout = null
			if (Object.keys(this.windows).length === 0) {
				this.showHomeWindow()
			}
		}, 50) // Small delay to allow all close events to process
	}

	async dispose() {
		if (this.homeWindowCheckTimeout) {
			clearTimeout(this.homeWindowCheckTimeout)
			this.homeWindowCheckTimeout = null
		}
	}

	async initialize() {
		await this.createHomeWindow()
		// Skip preloaded window during e2e tests to avoid race conditions
		if (!this.isPlaywrightTest) {
			await this.createPreloadedEditorWindow()
		}
	}

	async createHomeWindow() {
		const homeWindow = new BrowserWindow({
			...this.getBrowserWindowConfig(),
			width: 900,
			height: 670,
		})

		this.hideNativeTrafficLights(homeWindow)
		this.homeWindow = homeWindow

		homeWindow.webContents.setWindowOpenHandler((details) => {
			shell.openExternal(details.url)
			return { action: 'deny' }
		})

		// Update menu items when home window is focused (no file is open)
		homeWindow.on('focus', () => {
			this.mainManager.menu.updateMenuItemsEnabled()
		})

		this.windowReadyPromises[homeWindow.id] = new Promise<void>((r) =>
			homeWindow.on('ready-to-show', () => r())
		)

		await this.loadUrlInWindow(homeWindow, '/home')
	}

	async showHomeWindow() {
		if (this.showingHomeWindow) return
		this.showingHomeWindow = true
		this.homeWindow.show()
		console.log('home-window-show')
	}

	async hideHomeWindow() {
		if (!this.showingHomeWindow) return
		this.showingHomeWindow = false
		this.homeWindow.hide()
	}

	async showLicenseWindow() {
		if (this.licenseWindow && !this.licenseWindow.isDestroyed()) {
			this.licenseWindow.focus()
			return
		}

		this.licenseWindow = new BrowserWindow({
			...this.getBrowserWindowConfig(),
			width: 600,
			height: 500,
		})

		this.hideNativeTrafficLights(this.licenseWindow)

		this.licenseWindow.webContents.setWindowOpenHandler((details) => {
			shell.openExternal(details.url)
			return { action: 'deny' }
		})

		// Update menu items when license window is focused (no file is open)
		this.licenseWindow.on('focus', () => {
			this.mainManager.menu.updateMenuItemsEnabled()
		})

		this.licenseWindow.on('closed', () => {
			this.licenseWindow = null
		})

		await this.loadUrlInWindow(this.licenseWindow, '/license')
		this.licenseWindow.show()
		console.log('license-window-show')
	}

	async showAboutWindow() {
		if (this.aboutWindow && !this.aboutWindow.isDestroyed()) {
			this.aboutWindow.focus()
			return
		}

		this.aboutWindow = new BrowserWindow({
			...this.getBrowserWindowConfig(),
			width: 400,
			height: 360,
			resizable: false,
		})

		this.hideNativeTrafficLights(this.aboutWindow)

		this.aboutWindow.webContents.setWindowOpenHandler((details) => {
			shell.openExternal(details.url)
			return { action: 'deny' }
		})

		// Update menu items when about window is focused (no file is open)
		this.aboutWindow.on('focus', () => {
			this.mainManager.menu.updateMenuItemsEnabled()
		})

		this.aboutWindow.on('closed', () => {
			this.aboutWindow = null
		})

		await this.loadUrlInWindow(this.aboutWindow, '/about')
		this.aboutWindow.show()
		console.log('about-window-show')
	}

	async createPreloadedEditorWindow() {
		const editorWindow = new BrowserWindow({
			...this.getBrowserWindowConfig(),
			width: 1440,
			height: 900,
		})

		this.hideNativeTrafficLights(editorWindow)

		editorWindow.webContents.setWindowOpenHandler((details) => {
			shell.openExternal(details.url)
			return { action: 'deny' }
		})

		this.preloadedEditorWindow = editorWindow

		this.windowReadyPromises[editorWindow.id] = new Promise<void>((r) =>
			editorWindow.on('ready-to-show', () => r())
		)

		await this.loadUrlInWindow(editorWindow, `/f/PRELOAD`)
	}

	async getHomeWindow() {
		await this.windowReadyPromises[this.homeWindow.id]
		return this.homeWindow
	}

	async getEditorWindow(id: string) {
		if (!this.preloadedEditorWindow?.id) {
			// Create a fresh editor window (used in e2e tests or if preload is missing)
			const editorWindow = new BrowserWindow({
				...this.getBrowserWindowConfig(),
				width: 1440,
				height: 900,
			})

			this.hideNativeTrafficLights(editorWindow)

			editorWindow.webContents.setWindowOpenHandler((details) => {
				shell.openExternal(details.url)
				return { action: 'deny' }
			})

			this.windowReadyPromises[editorWindow.id] = new Promise<void>((r) =>
				editorWindow.on('ready-to-show', () => r())
			)

			await this.loadUrlInWindow(editorWindow, `/f/${id}`)
			await this.windowReadyPromises[editorWindow.id]
			return editorWindow
		}
		const editorWindow = this.preloadedEditorWindow!
		await this.windowReadyPromises[editorWindow.id]
		this.loadUrlInWindow(editorWindow, `/f/${id}`)
		return editorWindow
	}

	/**
	 * Creates a new editor window and returns the file data for the new window
	 * @param fileData - The file data to create the editor window with
	 */
	async createEditorInNewWindow(
		fileData: Omit<OpenFileData, 'window' | 'content'> &
			Partial<Pick<OpenFileData, 'window' | 'content'>>
	) {
		// create a new window and add it to windows
		const editorWindow = await this.getEditorWindow(fileData.id)
		this.preloadedEditorWindow = null

		const { id: windowId } = editorWindow
		this.windows[windowId] = editorWindow

		const disposals = this.setupEditorWindow(editorWindow, fileData)
		this.disposals[editorWindow.id] = () => disposals.forEach((d) => d())

		if (fileData.window) {
			this.restoreWindowToDisplay(editorWindow, fileData.window)
		} else {
			editorWindow.setSize(1440, 900)
			editorWindow.center()
		}

		// Show the editor window
		editorWindow.show()
		console.log('editor-window-created')

		// Close the home window if it exists
		this.hideHomeWindow()
	}

	/**
	 * Creates a new editor window in the given window
	 * @param fileData - The file data to create the editor window with
	 */
	async createEditorInOldEditorWindow(
		fileData: Omit<OpenFileData, 'content'> & Partial<Pick<OpenFileData, 'content'>>
	) {
		const window = this.get(fileData.window.id)
		if (!window) throw Error('Window not found')

		this.removeWindow(fileData.window.id)

		// Setup the editor window
		const disposals = this.setupEditorWindow(window, fileData)
		this.disposals[window.id] = () => disposals.forEach((d) => d())

		if (fileData.window) {
			this.restoreWindowToDisplay(window, fileData.window)
		}

		// Load the editor into the home window
		await this.loadUrlInWindow(window, `/f/${fileData.id}`)
	}

	private setupEditorWindow(
		window: BrowserWindow,
		fileData: Omit<OpenFileData, 'window' | 'content'> &
			Partial<Pick<OpenFileData, 'window' | 'content'>>
	) {
		const { id: windowId } = window

		const disposals: (() => void)[] = []

		// Create the new open file data in the store
		const newFileData: OpenFileData = {
			...fileData,
			window: this.getFreshWindowInfo(window),
			content: fileData.content ?? ({} as StoreSnapshot<TLRecord>),
		}

		// Create the new open file data in the store
		this.mainManager.store.openFiles.create(newFileData, 'open-new-window')

		// Create the new recent file data in the store
		if (newFileData.filePath) {
			this.mainManager.store.recentFiles.create(
				this.mainManager.openFileDataToRecentFileData(newFileData),
				'open-new-window'
			)

			// Start watching the file for external changes
			const unwatchFile = this.mainManager.fileWatcher.watchFile(
				newFileData.id,
				newFileData.filePath
			)
			disposals.push(unwatchFile)
		}

		// When the window is moved or resized, update the position in the store
		const updatePosition = () => {
			const windowInfo = this.getFreshWindowInfo(window)
			this.mainManager.store.openFiles.update(
				{
					id: newFileData.id,
					window: windowInfo,
				},
				'window-move-resize'
			)
			const fileData = this.mainManager.store.recentFiles.get(newFileData.id)
			if (fileData) {
				this.mainManager.store.recentFiles.update(
					{
						id: fileData.id,
						window: windowInfo,
					},
					'window-move-resize'
				)
			}
		}

		window.on('move', updatePosition)
		disposals.push(() => window.off('move', updatePosition))

		window.on('resize', updatePosition)
		disposals.push(() => window.off('resize', updatePosition))

		// When the window is focused, send a message to the renderer to focus the window
		const handleFocus = () => {
			this.mainManager.store.openFiles.update(
				{
					id: newFileData.id,
					window: this.getFreshWindowInfo(window),
				},
				'window-focus'
			)
			this.mainManager.events.sendMainEventToRenderer(window, {
				type: 'window-focus',
				payload: {},
			})
			// Update menu items enabled state when window is focused
			this.mainManager.menu.updateMenuItemsEnabled()
		}

		window.on('focus', handleFocus)
		disposals.push(() => window.off('focus', handleFocus))

		// When the window is blurred, send a message to the renderer to blur the window
		const handleBlur = () => {
			const allAreBlurred = !Object.values(this.windows)
				.filter((w) => !w.isDestroyed())
				.some((w) => w.isFocused())

			if (allAreBlurred) {
				// Blur the window if no other app window are focused
				this.mainManager.events.sendMainEventToRenderer(window, {
					type: 'window-blur',
					payload: {},
				})
			}
		}

		window.on('blur', handleBlur)
		disposals.push(() => window.off('blur', handleBlur))

		// When the user tries to close a window, check if there are unsaved changes with the associated file
		// If there are, prompt to save and only allow close if saved, otherwise cancel the close
		// If there are no unsaved changes, close the window
		const handleClose = async (e: Electron.Event) => {
			if (this.mainManager.isQuitting) return
			this.mainManager.store.persist()

			// Before anyone tries to close a file, let's persist the temporary file info store
			const fileData = this.mainManager.store.openFiles.get(newFileData.id)
			if (fileData?.unsavedChanges) {
				e.preventDefault()

				const result = await dialog.showMessageBox(window, {
					type: 'question',
					buttons: ['Save', 'Don’t Save', 'Cancel'],
					defaultId: 0,
					message: 'Do you want to save your changes?',
					detail: 'Your changes will be lost if you don’t save them.',
				})

				switch (result.response) {
					case 0: {
						// save the file...
						await this.mainManager.actions.saveCurrentFile({ closing: true })
						break
					}
					case 1: {
						// clear unsaved changes
						this.mainManager.store.updateOpenFileWithDirtyNotification(
							{
								id: newFileData.id,
								unsavedChanges: false,
							},
							'window-close-unsaved'
						)
						window.close()
						break
					}
					case 2: {
						// cancel the close, noop
						break
					}
				}
			}
		}

		window.on('close', handleClose)
		disposals.push(() => window.off('close', handleClose))

		// When the window is successfully closed, remove the open file data from the store
		const handleClosed = () => {
			// Unregister from sync before removing the file data
			this.mainManager.sync.unregisterWindow(newFileData.id, windowId)

			if (!this.mainManager.isQuitting) {
				this.mainManager.store.openFiles.remove(newFileData.id)
				this.removeWindow(windowId)
				this.scheduleHomeWindowCheck()
				// Skip preloaded window during e2e tests to avoid race conditions
				if (!this.isPlaywrightTest) {
					this.createPreloadedEditorWindow()
				}
			}
		}

		window.on('closed', handleClosed)
		disposals.push(() => window.off('closed', handleClosed))

		return disposals
	}

	/**
	 * Returns the currently focused window, or null if no window is focused
	 */
	getActive() {
		return BrowserWindow.getAllWindows().find((w) => w.isFocused())
	}

	getAll() {
		return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())
	}

	/**
	 * Returns the window with the given id, or null if no window is found
	 * @param windowId - The id of the window to get
	 */
	get(windowId: number) {
		return this.windows[windowId] ?? null
	}

	/**
	 * Loads the given url in the given window
	 * @param window - The window to load the url in
	 * @param url - The url to load
	 */
	private async loadUrlInWindow(window: BrowserWindow, url: string) {
		const userPreferences = this.mainManager.store.userPreferences.get()
		if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
			return await window.loadURL(
				process.env['ELECTRON_RENDERER_URL'] + '/#' + url + '?theme=' + userPreferences.theme
			)
		} else {
			return await window.loadFile(join(__dirname, '../renderer/index.html'), {
				hash: url,
				search: `?theme=${userPreferences.theme}`,
			})
		}
	}

	/**
	 * Hides the native traffic lights on macOS
	 */
	private hideNativeTrafficLights(window: BrowserWindow): void {
		if (process.platform === 'darwin') {
			window.setWindowButtonVisibility(false)
		}
	}

	/**
	 * Returns the default browser window config for the given platform
	 */
	private getBrowserWindowConfig(): Electron.BrowserWindowConstructorOptions {
		return {
			show: false,
			autoHideMenuBar: true,
			...(process.platform === 'darwin'
				? {
						frame: false,
						titleBarStyle: 'hidden',
						titleBarOverlay: false,
					}
				: {}),
			...(process.platform === 'linux' ? { icon } : {}),
			webPreferences: {
				preload: join(__dirname, '../preload/index.cjs'),
				sandbox: false,
			},
		}
	}

	getFreshWindowInfo(window: BrowserWindow): FileData['window'] {
		const bounds = window.getBounds()
		const display = screen.getDisplayMatching(bounds)
		if (!display) throw Error('Display not found')
		return {
			id: window.id,
			lastActive: Date.now(),
			bounds,
			displayId: display.id,
		}
	}

	/**
	 * Finds the best display for restoring a window based on stored window info.
	 * Returns the original display if still available, otherwise falls back to primary display.
	 */
	private getDisplayForRestore(windowInfo: FileData['window']): Electron.Display {
		const allDisplays = screen.getAllDisplays()

		// Try to find the original display by ID
		const originalDisplay = allDisplays.find((d) => d.id === windowInfo.displayId)
		if (originalDisplay) {
			return originalDisplay
		}

		// Fall back to primary display
		return screen.getPrimaryDisplay()
	}

	/**
	 * Adjusts window bounds to fit within a target display.
	 * If the original display is unavailable, repositions the window to the target display
	 * while preserving the window size.
	 */
	private adjustBoundsForDisplay(
		storedBounds: Electron.Rectangle,
		storedDisplayId: number,
		targetDisplay: Electron.Display
	): Electron.Rectangle {
		const { workArea } = targetDisplay

		// If restoring to the same display, use stored bounds directly
		// but ensure they're within the current work area (display resolution may have changed)
		if (targetDisplay.id === storedDisplayId) {
			return {
				x: Math.max(
					workArea.x,
					Math.min(storedBounds.x, workArea.x + workArea.width - storedBounds.width)
				),
				y: Math.max(
					workArea.y,
					Math.min(storedBounds.y, workArea.y + workArea.height - storedBounds.height)
				),
				width: Math.min(storedBounds.width, workArea.width),
				height: Math.min(storedBounds.height, workArea.height),
			}
		}

		// Restoring to a different display - center the window on the new display
		// while preserving the original size (if it fits)
		const width = Math.min(storedBounds.width, workArea.width)
		const height = Math.min(storedBounds.height, workArea.height)

		return {
			x: workArea.x + Math.floor((workArea.width - width) / 2),
			y: workArea.y + Math.floor((workArea.height - height) / 2),
			width,
			height,
		}
	}

	/**
	 * Restores a window to the correct display based on stored window info.
	 */
	private restoreWindowToDisplay(window: BrowserWindow, windowInfo: FileData['window']): void {
		const targetDisplay = this.getDisplayForRestore(windowInfo)
		const adjustedBounds = this.adjustBoundsForDisplay(
			windowInfo.bounds,
			windowInfo.displayId,
			targetDisplay
		)
		window.setBounds(adjustedBounds)
	}

	getWindowForFileData(fileData: OpenFileData): BrowserWindow | null {
		const window = this.get(fileData.window.id)
		if (!window) return null
		return window
	}

	removeWindow(windowId: number) {
		this.disposals[windowId]?.()
		delete this.windows[windowId]
		delete this.disposals[windowId]
	}
}
