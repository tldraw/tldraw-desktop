import { optimizer } from '@electron-toolkit/utils'
import { BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { OpenFileData, RecentFileData, TldrFileData } from 'src/types'
import { TLDocument } from 'tldraw'
import { ActionManager } from './ActionManager'
import { EventManager } from './EventManager'
import { FileWatcherManager } from './FileWatcherManager'
import { MenuManager } from './MenuManager'
import { StoreManager } from './StoreManager'
import { SyncManager } from './SyncManager'
import { UpdateManager } from './UpdateManager'
import { WindowManager } from './WindowManager'

export class MainManager {
	events = new EventManager(this)
	windows = new WindowManager(this)
	actions = new ActionManager(this)
	menu = new MenuManager(this)
	store = new StoreManager(this)
	sync = new SyncManager(this)
	updates = new UpdateManager(this)
	fileWatcher = new FileWatcherManager(this)

	isQuitting = false

	constructor(public app: Electron.App) {}

	async dispose() {
		for (const manager of [
			this.events,
			this.windows,
			this.actions,
			this.menu,
			this.store,
			this.sync,
			this.updates,
			this.fileWatcher,
		]) {
			manager.dispose()
		}
	}

	async initialize() {
		await this.events.initialize()

		this.setupAppHandlers()
		this.setupIpcHandlers()

		await this.windows.initialize()
		await this.menu.initialize()
		await this.store.initialize()
		await this.updates.initialize()

		// Restore files from last session
		const filesToRestore = this.store.openFiles.getAll()
		if (filesToRestore.length > 0) {
			await Promise.allSettled(
				filesToRestore.map((file) => this.windows.createEditorInNewWindow(file))
			)
			const lastActive = filesToRestore.sort((a, b) => b.window.lastActive - a.window.lastActive)[0]
			const window = this.windows.get(lastActive.window.id)
			if (window) window.focus()
		} else {
			// Create new empty window if no files to restore
			await this.actions.openHomeScreen()
		}

		// Cleanup any leftover "open files" that don't have a window
		for (const fileData of this.store.openFiles.getAll()) {
			if (!this.windows.get(fileData.window.id)) {
				this.store.openFiles.remove(fileData.id)
			}
		}
	}

	setupAppHandlers() {
		const { app } = this

		// Default open or close DevTools by F12 in development and ignore CommandOrControl + R in production. See https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
		app.on('browser-window-created', (_, window) => {
			optimizer.watchWindowShortcuts(window)
		})

		app.on('before-quit', () => {
			this.isQuitting = true
		})

		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		app.on('activate', () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				this.actions.openHomeScreen()
			}
		})

		// Quit when all windows are closed, except on macOS. There, it's common
		// for applications and their menu bar to stay active until the user quits
		// explicitly with Cmd + Q.
		app.on('window-all-closed', () => {
			if (process.platform === 'darwin') {
				// noop
			} else {
				app.quit()
			}
		})
	}

	setupIpcHandlers() {
		// Home window...

		// When the page loads, it will send a 'home-loaded' event
		this.events.onRendererEvent('home-loaded', async () => {
			// Send the home window its initial information
			const homeWindow = await this.windows.getHomeWindow()
			if (!homeWindow) throw new Error('Home window not found')
			this.events.sendMainEventToRenderer(homeWindow, {
				type: 'home-info-ready',
				payload: {
					recentFiles: this.store.getRecentFiles(),
					userPreferences: this.store.getUserPreferences(),
				},
			})
		})

		this.events.onRendererEvent('home-new-file', async () => {
			this.actions.createNewFile()
		})

		this.events.onRendererEvent('home-open-file', async () => {
			this.actions.openFiles()
		})

		this.events.onRendererEvent('home-open-recent-file', async ({ filePath }) => {
			// Check if the file is already open
			const openFileData = this.store.openFiles.getByFilePath(filePath)
			if (openFileData) {
				const window = this.windows.get(openFileData.window.id)
				if (window) window.focus()
				return
			}

			const dataFromFs = (await fs
				.readFile(filePath, 'utf8')
				.then((d) => JSON.parse(d))) as TldrFileData

			// Check if the file is in the recent files
			const recentFileData = this.store.getRecentFile(filePath)

			// Its possible that we have opened the file recently without saving it,
			// and so we should use the data from the recent file rather than the data
			// from the file system. This is because the data from the file system
			// may be stale compared to the data from the app's json of recent files.
			const documentRecord = dataFromFs.records.find(
				(r) => r.id === 'document:document'
			) as TLDocument
			if (!documentRecord) throw new Error('Document record not found')
			const fileLastModified = (documentRecord.meta as { desktop: { lastModified: number } })
				?.desktop?.lastModified

			if (recentFileData && fileLastModified && recentFileData.lastModified > fileLastModified) {
				// Combine the data from the file with the data from the recent file
				const finalData = {
					...recentFileData,
					lastActive: Date.now(),
					unsavedChanges: true,
					window: recentFileData.window,
				}
				this.windows.createEditorInNewWindow(finalData)
				return
			} else {
				// no recent files, or else unsaved changes, or if the file is newer or as new as the recent file
				this.actions.openFile(filePath)
			}
		})

		// Editor window...

		// When the page loads, it will send a 'editor-loaded' event
		this.events.onRendererEvent('editor-loaded', async ({ id }) => {
			const fileData = this.store.openFiles.get(id)
			if (!fileData) throw new Error('File data not found')
			const window = this.windows.get(fileData.window.id)
			if (!window) throw new Error('Window not found')
			// Send the home window its initial information
			this.events.sendMainEventToRenderer(window, {
				type: 'editor-info-ready',
				payload: {
					id: fileData.id,
					fileData,
					userPreferences: this.store.getUserPreferences(),
				},
			})
		})

		this.events.onRendererEvent('editor-update', async ({ id, snapshot, lastModified }) => {
			this.store.openFiles.update(
				{
					id,
					lastModified,
					unsavedChanges: true,
					content: snapshot,
				},
				'editor-update'
			)

			const recentFile = this.store.recentFiles.get(id)
			if (recentFile) {
				this.store.recentFiles.update(
					{
						id,
						lastModified,
					},
					'editor-update'
				)
			}
		})

		// Sync handlers for patch-based sync
		this.events.onRendererEvent(
			'editor-patch',
			async ({ documentId, changes, schema, windowId }) => {
				this.sync.handlePatch(documentId, changes, schema, windowId)
			}
		)

		this.events.onRendererEvent('editor-sync-register', async ({ documentId, windowId }) => {
			this.sync.registerWindow(documentId, windowId)
		})

		this.events.onRendererEvent('editor-sync-unregister', async ({ documentId, windowId }) => {
			this.sync.unregisterWindow(documentId, windowId)
		})

		this.events.onRendererEvent('editor-user-preferences-change', async (info) => {
			this.store.updateUserPreferences((v) => ({ ...v, ...info }))
		})

		this.events.onRendererEvent('editor-new-file', async () => {
			this.actions.createNewFile()
		})

		this.events.onRendererEvent('editor-open-file', async () => {
			this.actions.openFiles()
		})

		this.events.onRendererEvent('editor-save-file', async () => {
			this.actions.saveCurrentFile()
		})

		this.events.onRendererEvent('editor-save-as-file', async () => {
			this.actions.saveAsCurrentFile()
		})

		this.events.onRendererEvent('editor-rename-file', async () => {
			this.actions.renameCurrentFile()
		})

		this.events.onRendererEvent('show-home', async () => {
			this.actions.openHomeScreen()
		})

		this.events.onRendererEvent('window-focus', async () => {
			for (const window of BrowserWindow.getAllWindows()) {
				if (window.isFocused()) {
					this.events.sendMainEventToRenderer(window, { type: 'window-focus', payload: {} })
				}
			}
		})

		this.events.onRendererEvent('window-blur', async () => {
			for (const window of BrowserWindow.getAllWindows()) {
				if (!window.isFocused()) {
					this.events.sendMainEventToRenderer(window, { type: 'window-blur', payload: {} })
				}
			}
		})

		// Window control handlers
		this.events.onRendererEvent('window-control-close', async () => {
			const window = this.windows.getActive()
			if (window) window.close()
		})

		this.events.onRendererEvent('window-control-minimize', async () => {
			const window = this.windows.getActive()
			if (window) window.minimize()
		})

		this.events.onRendererEvent('window-control-maximize', async () => {
			const window = this.windows.getActive()
			if (window) {
				if (window.isMaximized()) {
					window.unmaximize()
				} else {
					window.maximize()
				}
			}
		})

		this.app.on('before-quit', () => {
			this.store.persist()
		})
	}

	openFileDataToRecentFileData(openFileData: OpenFileData): RecentFileData {
		if (!openFileData.filePath) throw new Error('File path is required')

		return {
			id: openFileData.id,
			filePath: openFileData.filePath,
			lastModified: openFileData.lastModified,
			lastOpened: openFileData.window.lastActive,
			window: openFileData.window,
		}
	}
}
