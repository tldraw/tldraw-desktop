import { dialog } from 'electron'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { MainManager } from './MainManager'

interface WatcherEntry {
	watcher: fs.FSWatcher
	filePath: string
	debounceTimer: NodeJS.Timeout | null
}

export class FileWatcherManager {
	private watchers: Map<string, WatcherEntry> = new Map() // fileId -> watcher entry
	private isDisabled: boolean

	constructor(public mainManager: MainManager) {
		// Disable file watching during e2e tests - fs.watch can cause race conditions
		// with rapid file operations in the test environment
		this.isDisabled = process.argv.includes('--playwright')
	}

	dispose() {
		for (const entry of this.watchers.values()) {
			entry.watcher.close()
			if (entry.debounceTimer) {
				clearTimeout(entry.debounceTimer)
			}
		}
		this.watchers.clear()
	}

	/**
	 * Start watching a file for changes.
	 * @param fileId - The unique identifier for the file
	 * @param filePath - The path to the file to watch
	 * @returns A cleanup function to stop watching
	 */
	watchFile(fileId: string, filePath: string): () => void {
		// Skip file watching during e2e tests to avoid race conditions
		if (this.isDisabled) {
			return () => {} // No-op cleanup function
		}

		// Stop any existing watcher for this file
		this.unwatchFile(fileId)

		try {
			// Watch the parent directory to detect renames
			const parentDir = path.dirname(filePath)

			const watcher = fs.watch(parentDir, (eventType, changedFileName) => {
				this.handleFileChange(fileId, filePath, eventType, changedFileName)
			})

			watcher.on('error', (error) => {
				console.error(`File watcher error for ${fileId}:`, error)
				// Clean up the watcher on error
				this.unwatchFile(fileId)
			})

			this.watchers.set(fileId, {
				watcher,
				filePath,
				debounceTimer: null,
			})

			console.log(`Started watching file: ${filePath} (${fileId})`)
		} catch (error) {
			console.error(`Failed to watch file ${filePath}:`, error)
		}

		return () => this.unwatchFile(fileId)
	}

	/**
	 * Stop watching a file.
	 * @param fileId - The unique identifier for the file
	 */
	unwatchFile(fileId: string): void {
		const entry = this.watchers.get(fileId)
		if (entry) {
			entry.watcher.close()
			if (entry.debounceTimer) {
				clearTimeout(entry.debounceTimer)
			}
			this.watchers.delete(fileId)
			console.log(`Stopped watching file: ${fileId}`)
		}
	}

	/**
	 * Update the watched file path (e.g., after Save As).
	 * @param fileId - The unique identifier for the file
	 * @param newFilePath - The new path to watch
	 */
	updateWatchedPath(fileId: string, newFilePath: string): void {
		this.watchFile(fileId, newFilePath)
	}

	/**
	 * Handle file system events.
	 */
	private handleFileChange(
		fileId: string,
		watchedFilePath: string,
		eventType: string,
		changedFileName: string | null
	): void {
		const entry = this.watchers.get(fileId)
		if (!entry) return

		const watchedFileName = path.basename(watchedFilePath)

		// Debounce rapid events
		if (entry.debounceTimer) {
			clearTimeout(entry.debounceTimer)
		}

		entry.debounceTimer = setTimeout(async () => {
			entry.debounceTimer = null

			// Check if our file still exists
			const fileExists = await this.fileExists(watchedFilePath)

			if (!fileExists) {
				// File was deleted or renamed
				// Try to find if it was renamed by scanning the directory
				const newPath = await this.findRenamedFile(fileId, watchedFilePath)

				if (newPath) {
					// File was renamed
					await this.handleFileRenamed(fileId, watchedFilePath, newPath)
				} else {
					// File was deleted
					await this.handleFileDeleted(fileId, watchedFilePath)
				}
			} else if (eventType === 'rename' && changedFileName === watchedFileName) {
				// File might have been modified in place (some editors do this)
				// This is typically harmless, but we could add handling if needed
			}
		}, 100) // 100ms debounce
	}

	/**
	 * Check if a file exists.
	 */
	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fsPromises.access(filePath, fs.constants.F_OK)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Try to find a renamed file by checking for .tldr files in the same directory
	 * that might be the renamed version of our file.
	 * This is a heuristic approach - we check if any new .tldr file appeared.
	 */
	private async findRenamedFile(fileId: string, oldFilePath: string): Promise<string | null> {
		const parentDir = path.dirname(oldFilePath)
		const openFileData = this.mainManager.store.openFiles.get(fileId)
		if (!openFileData) return null

		try {
			const files = await fsPromises.readdir(parentDir)
			const tldrFiles = files.filter((f) => f.endsWith('.tldr'))

			// Look for a .tldr file that contains our document ID
			for (const file of tldrFiles) {
				const fullPath = path.join(parentDir, file)
				if (fullPath === oldFilePath) continue

				try {
					const content = await fsPromises.readFile(fullPath, 'utf-8')
					const parsed = JSON.parse(content)

					// Check if this file has our document ID in its meta
					const documentRecord = parsed.records?.find(
						(r: { id?: string }) => r.id === 'document:document'
					)
					const documentId = documentRecord?.meta?.desktop?.id
					if (documentId === fileId) {
						return fullPath
					}
				} catch {
					// Could not read or parse this file, skip it
				}
			}
		} catch {
			// Could not read directory, skip
		}

		return null
	}

	/**
	 * Handle when a file is renamed externally.
	 */
	private async handleFileRenamed(fileId: string, oldPath: string, newPath: string): Promise<void> {
		console.log(`File renamed: ${oldPath} -> ${newPath}`)

		const openFileData = this.mainManager.store.openFiles.get(fileId)
		if (!openFileData) return

		const window = this.mainManager.windows.get(openFileData.window.id)
		if (!window) return

		// Update the file path in the store
		this.mainManager.store.openFiles.update(
			{
				id: fileId,
				filePath: newPath,
			},
			'file-renamed-externally'
		)

		// Update recent files if this file was previously saved
		const recentFile = this.mainManager.store.recentFiles.get(fileId)
		if (recentFile) {
			this.mainManager.store.recentFiles.update(
				{
					id: fileId,
					filePath: newPath,
				},
				'file-renamed-externally'
			)
		}

		// Notify the renderer of the path change
		this.mainManager.events.sendMainEventToRenderer(window, {
			type: 'file-path-change',
			payload: { id: fileId, filePath: newPath },
		})

		// Update the watcher to watch the new path
		this.watchFile(fileId, newPath)
	}

	/**
	 * Handle when a file is deleted externally.
	 */
	private async handleFileDeleted(fileId: string, filePath: string): Promise<void> {
		console.log(`File deleted: ${filePath}`)

		const openFileData = this.mainManager.store.openFiles.get(fileId)
		if (!openFileData) return

		const window = this.mainManager.windows.get(openFileData.window.id)
		if (!window || window.isDestroyed()) return

		// Stop watching since the file is gone
		this.unwatchFile(fileId)

		// Show a dialog asking the user what to do
		const result = await dialog.showMessageBox(window, {
			type: 'warning',
			buttons: ['Save As...', 'Keep Editing', 'Close'],
			defaultId: 0,
			cancelId: 2,
			title: 'File Deleted',
			message: 'The file has been deleted.',
			detail: `The file "${path.basename(filePath)}" has been deleted or moved outside the application. What would you like to do?`,
		})

		switch (result.response) {
			case 0: {
				// Save As - clear the file path and trigger save
				this.mainManager.store.openFiles.update(
					{
						id: fileId,
						filePath: null,
						unsavedChanges: true,
					},
					'file-deleted-externally'
				)

				// Notify renderer that file path has changed (effectively an unsaved file now)
				this.mainManager.events.sendMainEventToRenderer(window, {
					type: 'file-path-change',
					payload: { id: fileId, filePath: '' },
				})

				// Trigger save dialog
				await this.mainManager.actions.saveCurrentFile()
				break
			}
			case 1: {
				// Keep Editing - mark as unsaved and clear file path
				this.mainManager.store.openFiles.update(
					{
						id: fileId,
						filePath: null,
						unsavedChanges: true,
					},
					'file-deleted-externally'
				)

				// Notify renderer that file path has changed
				this.mainManager.events.sendMainEventToRenderer(window, {
					type: 'file-path-change',
					payload: { id: fileId, filePath: '' },
				})
				break
			}
			case 2: {
				// Close - mark as no unsaved changes and close
				this.mainManager.store.updateOpenFileWithDirtyNotification(
					{
						id: fileId,
						unsavedChanges: false,
					},
					'file-deleted-close'
				)
				window.close()
				break
			}
		}
	}
}
