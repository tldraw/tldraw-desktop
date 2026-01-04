import { app, BrowserWindow, nativeImage } from 'electron'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { AppStoreSchema, ConfigSchema, OpenFileData, RecentFilesSchema } from 'src/types'
import { Atom, atom } from 'tldraw'
import { MainManager } from './MainManager'

export class StoreManager {
	// Version 2.0.0 marks the switch to per-file storage
	version = '2.0.0'

	// Legacy migrations for the old single-file format (pre-2.0.0)
	legacyMigrations: Record<string, (store: AppStoreSchema) => AppStoreSchema> = {
		'1.0.1': (store) => {
			return {
				...store,
				version: '1.0.1',
				userPreferences: {
					...store.userPreferences,
					theme: 'light',
					isGridMode: false,
					isToolLocked: false,
					exportBackground: false,
				},
				featureFlags: {
					...store.featureFlags,
				},
			}
		},
		'1.0.2': (store) => {
			return {
				...store,
				version: '1.0.2',
				userPreferences: {
					...store.userPreferences,
					theme: 'light',
					isGridMode: false,
					isToolLocked: false,
					exportBackground: false,
				},
				featureFlags: {
					...store.featureFlags,
				},
			}
		},
	}

	// File paths for the new per-file storage format
	private get configPath() {
		return path.join(this.userDataPath, 'config.json')
	}
	private get recentFilesPath() {
		return path.join(this.userDataPath, 'recent-files.json')
	}
	private get filesDir() {
		return path.join(this.userDataPath, 'files')
	}
	private get legacyStorePath() {
		return path.join(this.userDataPath, 'open-files.json')
	}
	private openFilePath(id: string) {
		return path.join(this.filesDir, `${id}.json`)
	}

	openFiles = new ContentManager({} as AppStoreSchema['openFiles'], (data, reason, changedId) => {
		this.mainManager.events.sendMainEventToAllRenderers({
			type: 'open-files-change',
			payload: {
				openFiles: Object.values(data).sort((a, b) => b.lastModified - a.lastModified),
				reason,
			},
		})
		// Persist individual open file when it changes
		if (changedId && (reason === 'update' || reason === 'create')) {
			this.schedulePersistOpenFile(changedId)
		} else if (reason === 'remove' && changedId) {
			this.scheduleDeleteOpenFile(changedId)
		}
		// Update menu items enabled state when open files change
		this.mainManager.menu.updateMenuItemsEnabled()
	})

	recentFiles = new ContentManager({} as AppStoreSchema['recentFiles'], (data, reason) => {
		this.mainManager.events.sendMainEventToAllRenderers({
			type: 'recent-files-change',
			payload: {
				recentFiles: Object.values(data).sort((a, b) => b.lastOpened - a.lastOpened),
				reason,
			},
		})
		this.schedulePersistRecentFiles()
	})

	userPreferences = atom<AppStoreSchema['userPreferences']>('userPreferences', {
		theme: 'light',
		isGridMode: false,
		isToolLocked: false,
		exportBackground: false,
		autoCheckUpdates: true,
	})

	featureFlags = atom<AppStoreSchema['featureFlags']>('featureFlags', {})

	ready = false

	darkIcon = false

	userDataPath: string

	// Track dirty state for per-file persistence
	private dirtyOpenFiles = new Set<string>()
	private dirtyRecentFiles = false
	private dirtyConfig = false
	private filesToDelete = new Set<string>()
	private _persistingInterval: NodeJS.Timeout | null = null

	constructor(public mainManager: MainManager) {
		this.userDataPath = process.argv.includes('--playwright')
			? process.env.TEST_DATA_DIR!
			: app.getPath('userData')

		// Persist dirty files every second
		this._persistingInterval = setInterval(() => {
			this.persistDirty()
		}, 1000)
	}

	async dispose() {
		if (this._persistingInterval) {
			clearInterval(this._persistingInterval)
		}
		// Final persist on dispose
		await this.persistDirty()
	}

	// Schedule methods for dirty tracking
	private schedulePersistOpenFile(id: string) {
		this.dirtyOpenFiles.add(id)
	}

	private scheduleDeleteOpenFile(id: string) {
		this.dirtyOpenFiles.delete(id) // No need to persist if we're deleting
		this.filesToDelete.add(id)
	}

	private schedulePersistRecentFiles() {
		this.dirtyRecentFiles = true
	}

	private schedulePersistConfig() {
		this.dirtyConfig = true
	}

	/**
	 * Persist all dirty data
	 */
	private async persistDirty() {
		const promises: Promise<void>[] = []

		// Persist dirty open files
		for (const id of this.dirtyOpenFiles) {
			promises.push(this.persistOpenFile(id))
		}
		this.dirtyOpenFiles.clear()

		// Delete removed files
		for (const id of this.filesToDelete) {
			promises.push(this.deleteOpenFile(id))
		}
		this.filesToDelete.clear()

		// Persist recent files if dirty
		if (this.dirtyRecentFiles) {
			promises.push(this.persistRecentFiles())
			this.dirtyRecentFiles = false
		}

		// Persist config if dirty
		if (this.dirtyConfig) {
			promises.push(this.persistConfig())
			this.dirtyConfig = false
		}

		await Promise.all(promises)
	}

	/**
	 * Initialize the store
	 */
	async initialize() {
		try {
			// Check if we need to migrate from the old single-file format
			if (existsSync(this.legacyStorePath) && !existsSync(this.configPath)) {
				await this.migrateFromLegacyStore()
			} else {
				// Load from the new per-file format
				await this.loadFromPerFileStore()
			}
		} catch (e: any) {
			console.error('Could not load local store, using empty store', e.message)
			// Create fresh store files
			await this.ensureFilesDir()
			await this.persistConfig()
			await this.persistRecentFiles()
		}

		this.checkIcon()
		this.ready = true
	}

	/**
	 * Migrate from the legacy single-file format (open-files.json) to the new per-file format
	 */
	private async migrateFromLegacyStore() {
		console.log('Migrating from legacy store format...')

		const file = await fs.readFile(this.legacyStorePath, 'utf8')
		const data = JSON.parse(file) as AppStoreSchema
		let currentStore = data

		// Apply legacy migrations if needed
		for (const [version, migration] of Object.entries(this.legacyMigrations)) {
			if (currentStore.version >= version) continue
			currentStore = migration(currentStore)
		}

		// Ensure files directory exists
		await this.ensureFilesDir()

		// Set data in memory (don't trigger onChange callbacks during migration)
		this.openFiles.data.set(currentStore.openFiles ?? {})
		this.recentFiles.data.set(currentStore.recentFiles ?? {})
		this.featureFlags.set(currentStore.featureFlags ?? {})
		this.userPreferences.set(
			currentStore.userPreferences ?? {
				theme: 'light',
				isGridMode: false,
				isToolLocked: false,
				exportBackground: false,
				autoCheckUpdates: true,
			}
		)

		// Write all data to the new format
		await this.persistConfig()
		await this.persistRecentFiles()
		for (const id of Object.keys(currentStore.openFiles ?? {})) {
			await this.persistOpenFile(id)
		}

		// Backup and remove the legacy file
		const backupPath = this.legacyStorePath + '.backup'
		await fs.rename(this.legacyStorePath, backupPath)
		console.log(`Migration complete. Legacy store backed up to ${backupPath}`)
	}

	/**
	 * Load data from the new per-file storage format
	 */
	private async loadFromPerFileStore() {
		await this.ensureFilesDir()

		// Load config
		if (existsSync(this.configPath)) {
			const configFile = await fs.readFile(this.configPath, 'utf8')
			const config = JSON.parse(configFile) as ConfigSchema
			this.featureFlags.set(config.featureFlags ?? {})
			// Ensure autoCheckUpdates defaults to true for existing configs that don't have it
			const loadedPrefs = config.userPreferences ?? {
				theme: 'light',
				isGridMode: false,
				isToolLocked: false,
				exportBackground: false,
				autoCheckUpdates: true,
			}
			this.userPreferences.set({
				...loadedPrefs,
				autoCheckUpdates: loadedPrefs.autoCheckUpdates ?? true,
			})
		} else {
			// Create default config
			await this.persistConfig()
		}

		// Load recent files
		if (existsSync(this.recentFilesPath)) {
			const recentFilesFile = await fs.readFile(this.recentFilesPath, 'utf8')
			const recentFilesData = JSON.parse(recentFilesFile) as RecentFilesSchema
			this.recentFiles.data.set(recentFilesData.files ?? {})
		} else {
			// Create empty recent files
			await this.persistRecentFiles()
		}

		// Load open files from the files directory
		const openFilesData: Record<string, OpenFileData> = {}
		const filesDir = this.filesDir
		if (existsSync(filesDir)) {
			const files = await fs.readdir(filesDir)
			for (const file of files) {
				if (!file.endsWith('.json')) continue
				try {
					const filePath = path.join(filesDir, file)
					const content = await fs.readFile(filePath, 'utf8')
					const fileData = JSON.parse(content) as OpenFileData
					openFilesData[fileData.id] = fileData
				} catch (e: any) {
					console.error(`Failed to load open file ${file}:`, e.message)
				}
			}
		}
		this.openFiles.data.set(openFilesData)
	}

	/**
	 * Ensure the files directory exists
	 */
	private async ensureFilesDir() {
		if (!existsSync(this.filesDir)) {
			await fs.mkdir(this.filesDir, { recursive: true })
		}
	}

	/**
	 * Atomic write helper: writes to a temp file and renames to prevent corruption
	 */
	private async atomicWrite(filePath: string, data: string): Promise<void> {
		const tempPath = filePath + '.tmp'
		await fs.writeFile(tempPath, data)
		await fs.rename(tempPath, filePath)
	}

	/**
	 * Persist the config file (user preferences and feature flags)
	 */
	private async persistConfig(): Promise<void> {
		const config: ConfigSchema = {
			version: this.version,
			userPreferences: this.userPreferences.get(),
			featureFlags: this.featureFlags.get(),
		}
		await this.atomicWrite(this.configPath, JSON.stringify(config, null, 2))
	}

	/**
	 * Persist the recent files
	 */
	private async persistRecentFiles(): Promise<void> {
		const recentFiles: RecentFilesSchema = {
			version: this.version,
			files: this.recentFiles.getData(),
		}
		await this.atomicWrite(this.recentFilesPath, JSON.stringify(recentFiles, null, 2))
	}

	/**
	 * Persist a single open file
	 */
	private async persistOpenFile(id: string): Promise<void> {
		const fileData = this.openFiles.get(id)
		if (!fileData) return
		await this.ensureFilesDir()
		await this.atomicWrite(this.openFilePath(id), JSON.stringify(fileData, null, 2))
	}

	/**
	 * Delete an open file's storage
	 */
	private async deleteOpenFile(id: string): Promise<void> {
		const filePath = this.openFilePath(id)
		try {
			if (existsSync(filePath)) {
				await fs.unlink(filePath)
			}
		} catch (e: any) {
			console.error(`Failed to delete open file ${id}:`, e.message)
		}
	}

	checkIcon() {
		// todo: update the app icon based on the user preferences
		const isDarkMode = this.userPreferences.get().theme === 'dark'
		if (this.darkIcon === isDarkMode) return
		this.darkIcon = isDarkMode

		const iconPath = isDarkMode
			? path.join(__dirname, '..', '..', 'resources', 'Icon-dark-1024.png')
			: path.join(__dirname, '..', '..', 'resources', 'Icon-1024.png')

		const icon = nativeImage.createFromPath(iconPath)

		if (!icon || icon.isEmpty()) throw Error('Failed to load icon from ' + iconPath)

		for (const window of BrowserWindow.getAllWindows()) {
			window.setIcon(icon)
		}

		// Update macOS dock icon
		if (process.platform === 'darwin') {
			app.dock?.setIcon(icon)
		}
	}

	getUserPreferences() {
		return this.userPreferences.get()
	}

	updateUserPreferences(
		cb: (info: AppStoreSchema['userPreferences']) => AppStoreSchema['userPreferences']
	) {
		this.userPreferences.update(cb)
		const userPreferences = this.getUserPreferences()
		this.mainManager.events.sendMainEventToAllRenderers({
			type: 'user-preferences-change',
			payload: {
				userPreferences,
				reason: 'update',
			},
		})
		this.checkIcon()
		this.schedulePersistConfig()
	}

	getActiveOpenFileData(): OpenFileData | null {
		const activeWindow = BrowserWindow.getAllWindows().find((w) => w.isFocused())
		if (!activeWindow) return null
		const fileData = this.openFiles.getAll().find((file) => file.window.id === activeWindow.id)
		if (!fileData) return null
		return fileData
	}

	getLastActiveFile() {
		return (
			this.openFiles.getAll().sort((a, b) => b.window.lastActive - a.window.lastActive)[0] ?? null
		)
	}

	getRecentFiles() {
		return this.recentFiles.getAll().filter(Boolean)
	}

	getRecentFile(filePath: string) {
		return this.recentFiles.getByFilePath(filePath)
	}

	/**
	 * Force an immediate persist of all dirty data.
	 * This is called before quitting or closing windows.
	 */
	async persist(): Promise<void> {
		await this.persistDirty()
	}

	/**
	 * Update an open file and notify the renderer if unsavedChanges state changed.
	 * Also sets macOS native document edited state.
	 */
	updateOpenFileWithDirtyNotification(
		partial: Partial<OpenFileData> & { id: string },
		reason: string
	): void {
		const prev = this.openFiles.get(partial.id)
		this.openFiles.update(partial, reason)

		// If unsavedChanges changed, notify the window and set native document state
		if (prev && 'unsavedChanges' in partial && prev.unsavedChanges !== partial.unsavedChanges) {
			const fileData = this.openFiles.get(partial.id)
			if (fileData) {
				const window = this.mainManager.windows.get(fileData.window.id)
				if (window) {
					this.mainManager.events.sendMainEventToRenderer(window, {
						type: 'document-dirty-change',
						payload: {
							documentId: partial.id,
							unsavedChanges: partial.unsavedChanges!,
						},
					})
					// Set macOS native document edited state
					if (process.platform === 'darwin') {
						window.setDocumentEdited(partial.unsavedChanges!)
					}
				}
			}
		}
	}
}

class ContentManager<T extends { id: string; filePath: string | null }> {
	data: Atom<Record<string, T>>

	constructor(
		data: Record<string, T>,
		public onChange?: (
			data: Record<string, T>,
			reason: 'replace' | 'update' | 'create' | 'remove',
			changedId?: string
		) => void
	) {
		this.data = atom('openFiles', data)
	}

	getData() {
		return this.data.get()
	}

	/**
	 * Replace the data
	 * @param data
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	replace(data: Record<string, T>, _reason?: string) {
		this.data.set(data)
		this.onChange?.(data, 'replace')
	}

	/**
	 * Add an item
	 * @param openFileData
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	create(item: T, _reason?: string): void {
		this.data.update((s) => ({
			...s,
			[item.id]: {
				...item,
			},
		}))
		this.onChange?.(this.getData(), 'create', item.id)
	}

	/**
	 * Update an item
	 * @param partial
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	update(partial: Partial<T> & { id: string }, _reason?: string): void {
		this.data.update((s) => {
			const prev = s[partial.id]
			if (!prev) {
				throw Error('File not open')
			}
			return {
				...s,
				[prev.id]: {
					...prev,
					...partial,
				},
			}
		})
		this.onChange?.(this.getData(), 'update', partial.id)
	}

	/**
	 * Remove an item
	 * @param windowId - The windowId to remove the item for
	 */
	remove(id: string, reason?: string): void
	remove(item: T, reason?: string): void
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	remove(arg: string | T, _reason?: string): void {
		const id: string = typeof arg === 'object' ? arg.id : arg
		this.data.update((s) => {
			const copy = { ...s }
			delete copy[id]
			return copy
		})
		this.onChange?.(this.getData(), 'remove', id)
	}

	/**
	 * Get all items
	 * @returns
	 */
	getAll(): T[] {
		return Object.values(this.getData())
	}

	/**
	 * Get the item by its windowId
	 * @param windowId - The windowId to get the item for
	 * @returns
	 */
	get(key: string): T | undefined
	get(partial: Partial<T> & { id: string }): T | undefined
	get(arg: string | (Partial<T> & { id: string })): T | undefined {
		const id: string = typeof arg === 'object' ? arg.id : arg
		return this.data.get()[id]
	}

	/**
	 * Get the item by its file path
	 * @param filePath - The file path to get the item for
	 * @returns
	 */
	getByFilePath(filePath: string) {
		return this.getAll().find((item) => item.filePath === filePath)
	}
}
