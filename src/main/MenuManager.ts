import { app, BrowserWindow, Menu } from 'electron'
import path from 'path'
import { EditorMenuState } from 'src/types'
import { MainManager } from './MainManager'

export class MenuManager {
	private applicationMenu: Electron.Menu | null = null
	private editorMenuState: EditorMenuState | null = null

	constructor(public mainManager: MainManager) {}

	async dispose() {}

	async initialize() {
		this.rebuildMenu()

		// Rebuild menu when recent files change
		const originalOnChange = this.mainManager.store.recentFiles.onChange
		this.mainManager.store.recentFiles.onChange = (data, reason) => {
			originalOnChange?.(data, reason)
			this.rebuildMenu()
		}

		// Listen for editor state changes from renderer
		this.mainManager.events.onRendererEvent('editor-menu-state-changed', async ({ state }) => {
			this.editorMenuState = state
			this.updateEditorMenuItemsEnabled()
		})
	}

	/**
	 * Sends a menu action event to the currently focused editor window.
	 */
	private sendMenuAction(type: string) {
		const focusedWindow = BrowserWindow.getFocusedWindow()
		if (focusedWindow) {
			this.mainManager.events.sendMainEventToRenderer(focusedWindow, {
				type: type as any,
				payload: {},
			})
		}
	}

	/**
	 * Rebuilds the entire application menu. Called on initialization and when recent files change.
	 */
	private rebuildMenu() {
		const isMac = process.platform === 'darwin'

		const template: Array<Electron.MenuItemConstructorOptions | Electron.MenuItem> = []

		if (isMac) {
			template.push({
				label: app.name,
				submenu: [
					{
						label: `About ${app.name}`,
						id: 'app-about',
						click: () => {
							this.mainManager.windows.showAboutWindow()
						},
					},
					{ type: 'separator' },
					{ role: 'services' },
					{ type: 'separator' },
					{ role: 'hide' },
					{ role: 'hideOthers' },
					{ role: 'unhide' },
					{ type: 'separator' },
					{ role: 'quit' },
				],
			})
		}

		// File menu
		template.push({
			label: 'File',
			submenu: [
				{
					label: 'Home',
					id: 'home',
					click: () => {
						this.mainManager.actions.openHomeScreen()
					},
				},
				{
					id: 'file-new',
					label: 'New',
					accelerator: 'CmdOrCtrl+N',
					click: () => {
						this.mainManager.actions.createNewFile()
					},
				},
				{
					id: 'file-open',
					label: 'Open...',
					accelerator: 'CmdOrCtrl+O',
					click: () => {
						this.mainManager.actions.openFiles()
					},
				},
				{
					id: 'file-open-recent',
					label: 'Open Recent',
					submenu: this.buildRecentFilesSubmenu(),
				},
				{ type: 'separator' },
				{
					label: 'Close',
					id: 'file-close',
					accelerator: 'CmdOrCtrl+W',
					click: () => {
						this.mainManager.actions.closeCurrentFile()
					},
				},
				{
					label: 'Save',
					id: 'file-save',
					accelerator: 'CmdOrCtrl+S',
					click: () => {
						this.mainManager.actions.saveCurrentFile()
					},
				},
				{
					label: 'Save as',
					id: 'file-save-as',
					accelerator: 'CmdOrCtrl+Shift+S',
					click: () => {
						this.mainManager.actions.saveAsCurrentFile()
					},
				},
				{
					label: 'Rename...',
					id: 'file-rename',
					click: () => {
						this.mainManager.actions.renameCurrentFile()
					},
				},
				{ type: 'separator' },
				{
					label: 'Export',
					id: 'file-export',
					submenu: [
						{
							id: 'export-svg',
							label: 'Export as SVG...',
							click: () => this.sendMenuAction('menu-export-svg'),
						},
						{
							id: 'export-png',
							label: 'Export as PNG...',
							click: () => this.sendMenuAction('menu-export-png'),
						},
						{ type: 'separator' },
						{
							id: 'copy-as-svg',
							label: 'Copy as SVG',
							accelerator: 'CmdOrCtrl+Shift+C',
							click: () => this.sendMenuAction('menu-copy-as-svg'),
						},
						{
							id: 'copy-as-png',
							label: 'Copy as PNG',
							click: () => this.sendMenuAction('menu-copy-as-png'),
						},
					],
				},
				{ type: 'separator' },
				{
					label: 'Preferences',
					submenu: [
						{
							label: 'Toggle Theme',
							id: 'pref-theme',
							accelerator: 'CmdOrCtrl+/',
							click: () => {
								this.mainManager.store.updateUserPreferences((v) => ({
									...v,
									theme: v.theme === 'light' ? 'dark' : 'light',
								}))
							},
						},
						{ type: 'separator' },
						{
							label: 'Toggle Snap Mode',
							id: 'pref-snap-mode',
							type: 'checkbox',
							checked: this.editorMenuState?.isSnapMode ?? false,
							click: () => this.sendMenuAction('menu-toggle-snap-mode'),
						},
						{
							label: 'Toggle Tool Lock',
							id: 'pref-tool-lock',
							type: 'checkbox',
							checked: this.editorMenuState?.isToolLocked ?? false,
							click: () => this.sendMenuAction('menu-toggle-tool-lock'),
						},
						{ type: 'separator' },
						{
							label: 'Check for Updates Automatically',
							id: 'pref-auto-update',
							type: 'checkbox',
							checked: this.mainManager.store.getUserPreferences().autoCheckUpdates,
							click: (menuItem) => {
								this.mainManager.store.updateUserPreferences((v) => ({
									...v,
									autoCheckUpdates: menuItem.checked,
								}))
							},
						},
					],
				},
				{ type: 'separator' },
				isMac ? { role: 'close' } : { role: 'quit' },
			],
		})

		// Edit menu
		template.push({
			label: 'Edit',
			submenu: [
				{
					id: 'edit-undo',
					label: 'Undo',
					accelerator: 'CmdOrCtrl+Z',
					click: () => this.sendMenuAction('menu-undo'),
				},
				{
					id: 'edit-redo',
					label: 'Redo',
					accelerator: isMac ? 'CmdOrCtrl+Shift+Z' : 'CmdOrCtrl+Y',
					click: () => this.sendMenuAction('menu-redo'),
				},
				{ type: 'separator' },
				{
					id: 'edit-cut',
					label: 'Cut',
					accelerator: 'CmdOrCtrl+X',
					click: () => this.sendMenuAction('menu-cut'),
				},
				{
					id: 'edit-copy',
					label: 'Copy',
					accelerator: 'CmdOrCtrl+C',
					click: () => this.sendMenuAction('menu-copy'),
				},
				{
					id: 'edit-paste',
					label: 'Paste',
					accelerator: 'CmdOrCtrl+V',
					click: () => this.sendMenuAction('menu-paste'),
				},
				{
					id: 'edit-duplicate',
					label: 'Duplicate',
					accelerator: 'CmdOrCtrl+D',
					click: () => this.sendMenuAction('menu-duplicate'),
				},
				{
					id: 'edit-delete',
					label: 'Delete',
					accelerator: 'Backspace',
					click: () => this.sendMenuAction('menu-delete'),
				},
				{ type: 'separator' },
				{
					id: 'edit-select-all',
					label: 'Select All',
					accelerator: 'CmdOrCtrl+A',
					click: () => this.sendMenuAction('menu-select-all'),
				},
				{
					id: 'edit-select-none',
					label: 'Select None',
					click: () => this.sendMenuAction('menu-select-none'),
				},
				{ type: 'separator' },
				{
					id: 'edit-group',
					label: 'Group',
					accelerator: 'CmdOrCtrl+G',
					click: () => this.sendMenuAction('menu-group'),
				},
				{
					id: 'edit-ungroup',
					label: 'Ungroup',
					accelerator: 'CmdOrCtrl+Shift+G',
					click: () => this.sendMenuAction('menu-ungroup'),
				},
				{ type: 'separator' },
				{
					id: 'edit-lock',
					label: 'Toggle Lock',
					accelerator: 'Shift+L',
					click: () => this.sendMenuAction('menu-toggle-lock'),
				},
				{
					id: 'edit-unlock-all',
					label: 'Unlock All',
					click: () => this.sendMenuAction('menu-unlock-all'),
				},
			],
		})

		// Arrange menu
		template.push({
			label: 'Arrange',
			submenu: [
				{
					id: 'arrange-bring-to-front',
					label: 'Bring to Front',
					accelerator: ']',
					click: () => this.sendMenuAction('menu-bring-to-front'),
				},
				{
					id: 'arrange-bring-forward',
					label: 'Bring Forward',
					accelerator: 'Alt+]',
					click: () => this.sendMenuAction('menu-bring-forward'),
				},
				{
					id: 'arrange-send-backward',
					label: 'Send Backward',
					accelerator: 'Alt+[',
					click: () => this.sendMenuAction('menu-send-backward'),
				},
				{
					id: 'arrange-send-to-back',
					label: 'Send to Back',
					accelerator: '[',
					click: () => this.sendMenuAction('menu-send-to-back'),
				},
				{ type: 'separator' },
				{
					id: 'arrange-flip-h',
					label: 'Flip Horizontal',
					accelerator: 'Shift+H',
					click: () => this.sendMenuAction('menu-flip-horizontal'),
				},
				{
					id: 'arrange-flip-v',
					label: 'Flip Vertical',
					accelerator: 'Shift+V',
					click: () => this.sendMenuAction('menu-flip-vertical'),
				},
				{ type: 'separator' },
				{
					id: 'arrange-rotate-cw',
					label: 'Rotate Clockwise',
					accelerator: 'Shift+.',
					click: () => this.sendMenuAction('menu-rotate-cw'),
				},
				{
					id: 'arrange-rotate-ccw',
					label: 'Rotate Counter-clockwise',
					accelerator: 'Shift+,',
					click: () => this.sendMenuAction('menu-rotate-ccw'),
				},
			],
		})

		// View menu
		template.push({
			label: 'View',
			submenu: [
				{
					id: 'view-zoom-in',
					label: 'Zoom In',
					accelerator: 'CmdOrCtrl+=',
					click: () => this.sendMenuAction('menu-zoom-in'),
				},
				{
					id: 'view-zoom-out',
					label: 'Zoom Out',
					accelerator: 'CmdOrCtrl+-',
					click: () => this.sendMenuAction('menu-zoom-out'),
				},
				{
					id: 'view-zoom-100',
					label: 'Zoom to 100%',
					accelerator: 'Shift+0',
					click: () => this.sendMenuAction('menu-zoom-to-100'),
				},
				{
					id: 'view-zoom-fit',
					label: 'Zoom to Fit',
					accelerator: 'Shift+1',
					click: () => this.sendMenuAction('menu-zoom-to-fit'),
				},
				{
					id: 'view-zoom-selection',
					label: 'Zoom to Selection',
					accelerator: 'Shift+2',
					click: () => this.sendMenuAction('menu-zoom-to-selection'),
				},
				{ type: 'separator' },
				{
					id: 'view-grid',
					label: 'Show Grid',
					type: 'checkbox',
					checked: this.editorMenuState?.isGridMode ?? false,
					accelerator: "CmdOrCtrl+'",
					click: () => this.sendMenuAction('menu-toggle-grid'),
				},
				{
					id: 'view-focus-mode',
					label: 'Focus Mode',
					type: 'checkbox',
					checked: this.editorMenuState?.isFocusMode ?? false,
					accelerator: 'CmdOrCtrl+.',
					click: () => this.sendMenuAction('menu-toggle-focus-mode'),
				},
				{
					id: 'view-debug-mode',
					label: 'Debug Mode',
					type: 'checkbox',
					checked: this.editorMenuState?.isDebugMode ?? false,
					click: () => this.sendMenuAction('menu-toggle-debug-mode'),
				},
				{ type: 'separator' },
				{ role: 'reload' },
				{ role: 'forceReload' },
				{ role: 'toggleDevTools' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' },
			],
		})

		// Insert menu
		template.push({
			label: 'Insert',
			submenu: [
				{
					id: 'insert-media',
					label: 'Insert Media...',
					accelerator: 'CmdOrCtrl+U',
					click: () => this.sendMenuAction('menu-insert-media'),
				},
				{
					id: 'insert-embed',
					label: 'Insert Embed...',
					accelerator: 'CmdOrCtrl+I',
					click: () => this.sendMenuAction('menu-insert-embed'),
				},
			],
		})

		// Help menu
		template.push({
			label: 'Help',
			submenu: [
				{
					label: 'Check for Updates...',
					click: () => {
						this.mainManager.updates.checkForUpdates(true)
					},
				},
				{ type: 'separator' },
				{
					label: 'License',
					id: 'help-license',
					click: () => {
						this.mainManager.windows.showLicenseWindow()
					},
				},
				...(isMac
					? []
					: [
							{ type: 'separator' as const },
							{
								label: 'About',
								id: 'help-about',
								click: () => {
									this.mainManager.windows.showAboutWindow()
								},
							},
						]),
			],
		})

		const menu = Menu.buildFromTemplate(template)
		Menu.setApplicationMenu(menu)
		this.applicationMenu = menu

		// Set initial menu state
		this.updateMenuItemsEnabled()
	}

	/**
	 * Updates the enabled state of file menu items based on whether a file is open.
	 * Should be called when window focus changes or when files are opened/closed.
	 */
	updateMenuItemsEnabled() {
		if (!this.applicationMenu) return

		const fileData = this.mainManager.store.getActiveOpenFileData()
		const hasOpenFile = fileData !== null
		const isSaved = hasOpenFile && fileData.filePath !== null

		const saveItem = this.applicationMenu.getMenuItemById('file-save')
		const saveAsItem = this.applicationMenu.getMenuItemById('file-save-as')
		const closeItem = this.applicationMenu.getMenuItemById('file-close')
		const renameItem = this.applicationMenu.getMenuItemById('file-rename')

		if (saveItem) saveItem.enabled = hasOpenFile
		if (saveAsItem) saveAsItem.enabled = hasOpenFile
		if (closeItem) closeItem.enabled = hasOpenFile
		if (renameItem) renameItem.enabled = isSaved

		// Update editor-specific items
		this.updateEditorMenuItemsEnabled()
	}

	/**
	 * Updates the enabled state of editor menu items based on the editor state.
	 */
	private updateEditorMenuItemsEnabled() {
		if (!this.applicationMenu) return

		const state = this.editorMenuState
		const fileData = this.mainManager.store.getActiveOpenFileData()
		const hasOpenFile = fileData !== null

		// If no editor state, disable all editor-specific items
		const hasState = state !== null && hasOpenFile

		// Undo/Redo
		const undoItem = this.applicationMenu.getMenuItemById('edit-undo')
		const redoItem = this.applicationMenu.getMenuItemById('edit-redo')
		if (undoItem) undoItem.enabled = hasState && (state?.canUndo ?? false)
		if (redoItem) redoItem.enabled = hasState && (state?.canRedo ?? false)

		// Selection-based items (need unlocked selection)
		const cutItem = this.applicationMenu.getMenuItemById('edit-cut')
		const duplicateItem = this.applicationMenu.getMenuItemById('edit-duplicate')
		const deleteItem = this.applicationMenu.getMenuItemById('edit-delete')
		const hasUnlockedSelection = hasState && (state?.hasUnlockedSelection ?? false)
		if (cutItem) cutItem.enabled = hasUnlockedSelection
		if (duplicateItem) duplicateItem.enabled = hasUnlockedSelection
		if (deleteItem) deleteItem.enabled = hasUnlockedSelection

		// Copy needs selection (even locked)
		const copyItem = this.applicationMenu.getMenuItemById('edit-copy')
		const hasSelection = hasState && (state?.hasSelection ?? false)
		if (copyItem) copyItem.enabled = hasSelection

		// Paste is always enabled when there's an open file
		const pasteItem = this.applicationMenu.getMenuItemById('edit-paste')
		if (pasteItem) pasteItem.enabled = hasOpenFile

		// Select all/none
		const selectAllItem = this.applicationMenu.getMenuItemById('edit-select-all')
		const selectNoneItem = this.applicationMenu.getMenuItemById('edit-select-none')
		if (selectAllItem) selectAllItem.enabled = hasOpenFile
		if (selectNoneItem) selectNoneItem.enabled = hasSelection

		// Group/Ungroup
		const groupItem = this.applicationMenu.getMenuItemById('edit-group')
		const ungroupItem = this.applicationMenu.getMenuItemById('edit-ungroup')
		const hasMultipleUnlockedSelection = hasState && (state?.hasMultipleUnlockedSelection ?? false)
		const hasGroupSelected = hasState && (state?.hasGroupSelected ?? false)
		if (groupItem) groupItem.enabled = hasMultipleUnlockedSelection
		if (ungroupItem) ungroupItem.enabled = hasGroupSelected

		// Lock/Unlock
		const lockItem = this.applicationMenu.getMenuItemById('edit-lock')
		const unlockAllItem = this.applicationMenu.getMenuItemById('edit-unlock-all')
		if (lockItem) lockItem.enabled = hasSelection
		if (unlockAllItem) unlockAllItem.enabled = hasOpenFile

		// Arrange items - need unlocked selection
		const arrangeItems = [
			'arrange-bring-to-front',
			'arrange-bring-forward',
			'arrange-send-backward',
			'arrange-send-to-back',
			'arrange-flip-h',
			'arrange-flip-v',
			'arrange-rotate-cw',
			'arrange-rotate-ccw',
		]
		for (const id of arrangeItems) {
			const item = this.applicationMenu.getMenuItemById(id)
			if (item) item.enabled = hasUnlockedSelection
		}

		// Zoom to selection
		const zoomSelectionItem = this.applicationMenu.getMenuItemById('view-zoom-selection')
		if (zoomSelectionItem) zoomSelectionItem.enabled = hasSelection

		// Zoom items (always enabled when file is open)
		const zoomItems = ['view-zoom-in', 'view-zoom-out', 'view-zoom-100', 'view-zoom-fit']
		for (const id of zoomItems) {
			const item = this.applicationMenu.getMenuItemById(id)
			if (item) item.enabled = hasOpenFile
		}

		// View toggles (checkboxes) - update checked state
		const gridItem = this.applicationMenu.getMenuItemById('view-grid')
		const focusModeItem = this.applicationMenu.getMenuItemById('view-focus-mode')
		const debugModeItem = this.applicationMenu.getMenuItemById('view-debug-mode')
		const snapModeItem = this.applicationMenu.getMenuItemById('pref-snap-mode')
		const toolLockItem = this.applicationMenu.getMenuItemById('pref-tool-lock')

		if (gridItem) {
			gridItem.enabled = hasOpenFile
			gridItem.checked = state?.isGridMode ?? false
		}
		if (focusModeItem) {
			focusModeItem.enabled = hasOpenFile
			focusModeItem.checked = state?.isFocusMode ?? false
		}
		if (debugModeItem) {
			debugModeItem.enabled = hasOpenFile
			debugModeItem.checked = state?.isDebugMode ?? false
		}
		if (snapModeItem) {
			snapModeItem.enabled = hasOpenFile
			snapModeItem.checked = state?.isSnapMode ?? false
		}
		if (toolLockItem) {
			toolLockItem.enabled = hasOpenFile
			toolLockItem.checked = state?.isToolLocked ?? false
		}

		// Export items
		const exportItems = ['export-svg', 'export-png', 'copy-as-svg', 'copy-as-png']
		for (const id of exportItems) {
			const item = this.applicationMenu.getMenuItemById(id)
			if (item) item.enabled = hasOpenFile
		}

		// Insert items
		const insertItems = ['insert-media', 'insert-embed']
		for (const id of insertItems) {
			const item = this.applicationMenu.getMenuItemById(id)
			if (item) item.enabled = hasOpenFile
		}
	}

	/**
	 * Builds the "Open Recent" submenu items from the recent files list.
	 */
	private buildRecentFilesSubmenu(): Electron.MenuItemConstructorOptions[] {
		const recentFiles = this.mainManager.store.getRecentFiles().slice(0, 10)

		if (recentFiles.length === 0) {
			return [{ label: 'No Recent Files', enabled: false }]
		}

		const items: Electron.MenuItemConstructorOptions[] = recentFiles.map((file, i) => ({
			label: `${path.basename(file.filePath)} - ${path.dirname(file.filePath)}`,
			id: `file-recent-${i}`,
			click: () => this.mainManager.actions.openFile(file.filePath),
		}))

		items.push({ type: 'separator' })
		items.push({
			label: 'Clear Recent',
			id: 'file-open-recent-clear',
			click: () => {
				const files = this.mainManager.store.getRecentFiles()
				files.forEach((f) => this.mainManager.store.recentFiles.remove(f.id))
			},
		})

		return items
	}
}
