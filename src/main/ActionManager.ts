import { app, BrowserWindow, dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { ActionResult, OpenFileData } from 'src/types'
import { createTLSchema, parseTldrawJsonFile, uniqueId } from 'tldraw'
import { MainManager } from './MainManager'

const DEFAULT_SCHEMA = createTLSchema()
let testSaveId = 1

/**
 * In test mode, finds the most recent .tldr file in the test directory.
 * This ensures File > Open opens a previously saved file, not a non-existent one.
 */
async function findMostRecentTestFile(testDataDir: string): Promise<string | null> {
	try {
		const files = await fs.readdir(testDataDir)
		const tldrFiles = files.filter((f) => f.endsWith('.tldr'))
		if (tldrFiles.length === 0) return null

		// Sort by modification time (most recent first)
		const filesWithStats = await Promise.all(
			tldrFiles.map(async (file) => {
				const filePath = path.join(testDataDir, file)
				const stat = await fs.stat(filePath)
				return { file, mtime: stat.mtimeMs }
			})
		)
		filesWithStats.sort((a, b) => b.mtime - a.mtime)
		return path.join(testDataDir, filesWithStats[0].file)
	} catch {
		return null
	}
}

export class ActionManager {
	constructor(public mainManager: MainManager) {}

	dispose() {}

	/**
	 * Opens the home screen
	 */
	async openHomeScreen(): Promise<ActionResult> {
		try {
			await this.mainManager.windows.showHomeWindow()
			return { success: true }
		} catch (err: any) {
			return { success: false, error: err.message }
		}
	}

	/**
	 * Creates a new file
	 */
	async createNewFile(): Promise<ActionResult> {
		try {
			this.mainManager.windows.createEditorInNewWindow({
				id: uniqueId(),
				filePath: null,
				lastModified: Date.now(),
				lastOpened: Date.now(),
				unsavedChanges: false,
			})
			return { success: true }
		} catch (err: any) {
			return { success: false, error: err.message }
		}
	}

	/**
	 * Opens a file
	 */
	async openFiles(): Promise<ActionResult> {
		let filePaths: string[]

		if (process.env.TEST_DATA_DIR) {
			// In test mode, open the most recently saved file
			const mostRecentFile = await findMostRecentTestFile(process.env.TEST_DATA_DIR)
			if (!mostRecentFile) {
				return { success: false, error: 'No test files found to open' }
			}
			filePaths = [mostRecentFile]
		} else {
			const { canceled, filePaths: _filePaths } = await dialog.showOpenDialog({
				properties: ['openFile'],
				filters: [
					{ name: 'tldraw Files', extensions: ['tldr'] },
					{ name: 'All Files', extensions: ['*'] },
				],
			})

			if (canceled) return { success: false, error: 'cancelled' }
			filePaths = _filePaths
		}

		await Promise.allSettled(filePaths.map((filePath) => this.openFile(filePath)))

		return { success: true }
	}

	/**
	 * Opens a file
	 */
	async openFile(filePath: string): Promise<ActionResult> {
		try {
			const fileData = this.mainManager.store.openFiles.getByFilePath(filePath)
			if (fileData) {
				// The file is already open, so focus the window or bring it to the front
				// get the window with the file data's windowId
				const window = this.mainManager.windows.getWindowForFileData(fileData)
				if (window) {
					app.focus()
					window.focus()
				}
			} else {
				// The file is not open, so open it in a new window
				const document = await fs.readFile(filePath, 'utf-8')

				const parseFileResult = parseTldrawJsonFile({
					schema: DEFAULT_SCHEMA,
					json: document,
				})

				if (!parseFileResult.ok) {
					throw new Error('Failed to parse file')
				}

				const snapshot = parseFileResult.value.getStoreSnapshot()

				const documentRecord = Object.values(snapshot.store).find((r) => r.typeName === 'document')
				if (!documentRecord) throw new Error('Document record not found')

				if (documentRecord.meta?.desktop) {
					// We've opened this file before, or we created it, so we can use the same id
					const { id, lastModified } = documentRecord.meta.desktop as {
						id: string
						lastModified: number
					}

					const recentFileData = this.mainManager.store.getRecentFile(filePath)

					this.mainManager.windows.createEditorInNewWindow({
						id,
						lastModified,
						lastOpened: Date.now(),
						filePath: filePath,
						content: snapshot,
						unsavedChanges: false,
						...(recentFileData ? { window: recentFileData.window } : {}),
					})
				} else {
					// We've never opened this file before, so we need to create a new id
					this.mainManager.windows.createEditorInNewWindow({
						id: uniqueId(),
						lastModified: Date.now(),
						lastOpened: Date.now(),
						filePath: filePath,
						content: snapshot,
						unsavedChanges: false,
					})
				}
			}
		} catch (err: any) {
			return { success: false, error: err.message }
		}

		return { success: true }
	}

	/**
	 * Closes the current file
	 */
	async closeCurrentFile(): Promise<ActionResult> {
		try {
			// Close the current file, prompting the user to save if they have unsaved changes
			// close the user's acrtive window
			const window = BrowserWindow.getAllWindows().find((w) => w.isFocused())
			if (window) {
				window.close() // this will trigger the window-closed event, which removes the open file data from the store
			} else {
				return { success: false, error: 'No active window' }
			}
			return { success: true }
		} catch (err: any) {
			return { success: false, error: err.message }
		}
	}

	/**
	 * Renames the current file
	 */
	async renameCurrentFile(): Promise<ActionResult> {
		const openFileData = this.mainManager.store.getActiveOpenFileData()
		if (!openFileData) {
			return { success: false, error: 'No active file' }
		}

		if (!openFileData.filePath) {
			return { success: false, error: 'Cannot rename unsaved file' }
		}

		const editorWindow = this.mainManager.windows.get(openFileData.window.id)
		if (!editorWindow) {
			return { success: false, error: 'Window not found' }
		}

		const oldFilePath = openFileData.filePath
		const oldDir = path.dirname(oldFilePath)

		let newFilePath: string | undefined

		if (process.env.TEST_DATA_DIR) {
			// In test mode, use a predetermined rename path
			newFilePath = path.join(oldDir, `renamed-${Date.now()}.tldr`)
		} else {
			const { canceled, filePath } = await dialog.showSaveDialog(editorWindow, {
				defaultPath: oldFilePath,
				filters: [
					{ name: 'tldraw Files', extensions: ['tldr'] },
					{ name: 'All Files', extensions: ['*'] },
				],
				title: 'Rename File',
				buttonLabel: 'Rename',
				nameFieldLabel: 'New name:',
			})

			if (canceled || !filePath) {
				return { success: false, error: 'cancelled' }
			}

			newFilePath = filePath
		}

		// Don't do anything if the path hasn't changed
		if (newFilePath === oldFilePath) {
			return { success: true }
		}

		try {
			// Stop watching the old file path
			this.mainManager.fileWatcher.unwatchFile(openFileData.id)

			// Rename the file on disk
			await fs.rename(oldFilePath, newFilePath)

			// Update the open file data with the new path
			this.mainManager.store.openFiles.update(
				{
					id: openFileData.id,
					filePath: newFilePath,
				},
				'rename-file'
			)

			// Update the recent files list: remove old path entry if exists, add new path
			const oldRecentFile = this.mainManager.store.recentFiles.getByFilePath(oldFilePath)
			if (oldRecentFile) {
				this.mainManager.store.recentFiles.remove(oldRecentFile.id, 'rename-file-remove-old')
			}

			// Create a new recent file entry with the new path
			const updatedFileData = this.mainManager.store.openFiles.get(openFileData.id)!
			this.mainManager.store.recentFiles.create(
				this.mainManager.openFileDataToRecentFileData(updatedFileData),
				'rename-file-add-new'
			)

			// Notify the renderer about the file path change
			this.mainManager.events.sendMainEventToRenderer(editorWindow, {
				type: 'file-path-change',
				payload: { id: openFileData.id, filePath: newFilePath },
			})

			// Start watching the new file path
			this.mainManager.fileWatcher.watchFile(openFileData.id, newFilePath)

			return { success: true }
		} catch (err: any) {
			// If rename failed, try to restart watching the old file
			try {
				this.mainManager.fileWatcher.watchFile(openFileData.id, oldFilePath)
			} catch {
				// Ignore errors when trying to restore file watching
			}
			return { success: false, error: err.message }
		}
	}

	/**
	 * Saves the current file
	 */
	async saveCurrentFile(info: { closing?: boolean } = {}): Promise<ActionResult> {
		const openFileData = this.mainManager.store.getActiveOpenFileData()
		if (!openFileData) return { success: true } // could be saving home screen

		const editorWindow = this.mainManager.windows.get(openFileData.window.id)
		if (!editorWindow) return { success: false, error: 'Window not found' }

		try {
			// Invoke the renderer to get the serialized file data
			const { serializedTldrFileData, lastModified } =
				await this.mainManager.events.invokeRenderer(editorWindow, 'editor-save', {
					id: openFileData.id,
					closing: info.closing,
				})

			// Handle the save response
			return await this.handleSaveResponse(
				openFileData.id,
				serializedTldrFileData,
				lastModified,
				info.closing
			)
		} catch (err: unknown) {
			return { success: false, error: err instanceof Error ? err.message : String(err) }
		}
	}

	private async handleSaveResponse(
		id: string,
		stringifiedTldrFileData: string,
		lastModified: number,
		closing?: boolean
	): Promise<ActionResult> {
		const openFileData = this.mainManager.store.openFiles.get(id)
		if (!openFileData) {
			return { success: true } // could be saving home screen
		}

		const editorWindow = this.mainManager.windows.get(openFileData.window.id)
		if (!editorWindow) throw new Error('Window not found')

		try {
			if (!openFileData.filePath) {
				let filePath: string | undefined

				if (process.env.TEST_DATA_DIR) {
					// Use a predetermined path for tests
					filePath = path.join(process.env.TEST_DATA_DIR, `test-${testSaveId++}.tldr`)
				} else {
					// Save for the first time
					const { canceled, filePath: _filePath } = await dialog.showSaveDialog({
						filters: [
							{ name: 'tldraw Files', extensions: ['tldr'] },
							{ name: 'All Files', extensions: ['*'] },
						],
					})

					if (!canceled) {
						filePath = _filePath
					}
				}

				if (filePath) {
					// Save to new file path

					// Update and notify about dirty state change
					this.mainManager.store.updateOpenFileWithDirtyNotification(
						{
							id: openFileData.id,
							filePath,
							unsavedChanges: false,
							lastModified,
							window: this.mainManager.windows.getFreshWindowInfo(editorWindow),
						},
						'save-current-file'
					)

					const latestFileData = this.mainManager.store.openFiles.get(openFileData.id)!

					this.mainManager.store.recentFiles.create(
						this.mainManager.openFileDataToRecentFileData(latestFileData),
						'save-current-file-recent-file'
					)

					this.mainManager.events.sendMainEventToRenderer(editorWindow, {
						type: 'file-path-change',
						payload: { id: openFileData.id, filePath },
					})

					await fs.writeFile(filePath, stringifiedTldrFileData, 'utf-8')

					// Start watching the newly saved file for external changes
					this.mainManager.fileWatcher.watchFile(openFileData.id, filePath)

					if (closing) {
						editorWindow.close()
					}
					return { success: true }
				} else {
					// maybe cancelled, all good
					return { success: true }
				}
			} else {
				// Save to existing file path

				// Update and notify about dirty state change
				this.mainManager.store.updateOpenFileWithDirtyNotification(
					{
						id: openFileData.id,
						lastModified,
						unsavedChanges: false,
					},
					'save-current-file'
				)

				const latestFileData = this.mainManager.store.openFiles.get(openFileData.id)!

				// Update the file in our recent files
				this.mainManager.store.recentFiles.create(
					this.mainManager.openFileDataToRecentFileData(latestFileData),
					'save-current-file-recent-file'
				)

				// Write the file to disk
				await fs.writeFile(openFileData.filePath, stringifiedTldrFileData, 'utf-8')

				if (closing) {
					editorWindow.close()
				}

				return { success: true }
			}
		} catch (err: unknown) {
			return { success: false, error: err instanceof Error ? err.message : String(err) }
		}
	}

	/**
	 * Saves the current file as a new file
	 */
	async saveAsCurrentFile(): Promise<ActionResult> {
		const openFileData = this.mainManager.store.getActiveOpenFileData()
		if (!openFileData) return { success: true } // could be saving home screen

		const editorWindow = this.mainManager.windows.get(openFileData.window.id)
		if (!editorWindow) return { success: false, error: 'Window not found' }

		try {
			// Invoke the renderer to get the serialized file data
			const { serializedTldrFileData, lastModified } =
				await this.mainManager.events.invokeRenderer(editorWindow, 'editor-save-as', {
					id: openFileData.id,
				})

			// Handle the save-as response
			return await this.handleSaveAsResponse(
				openFileData.id,
				serializedTldrFileData,
				lastModified
			)
		} catch (err: unknown) {
			return { success: false, error: err instanceof Error ? err.message : String(err) }
		}
	}

	private async handleSaveAsResponse(
		id: string,
		stringifiedTldrFileData: string,
		lastModified: number
	): Promise<ActionResult> {
		const openFileData = this.mainManager.store.openFiles.get(id)
		if (!openFileData) return { success: true } // could be saving home screen

		const { canceled, filePath } = await dialog.showSaveDialog({
			filters: [
				{ name: 'tldraw Files', extensions: ['tldr'] },
				{ name: 'All Files', extensions: ['*'] },
			],
		})

		if (!canceled && filePath) {
			// Get a fresh copy of the file data from the store
			const prevFileData = this.mainManager.store.openFiles.get(id)
			if (!prevFileData) throw new Error('File data not found')

			try {
				// Stop watching the old file (if any)
				this.mainManager.fileWatcher.unwatchFile(id)

				// Create a new open file data with the new filePath etc
				// This will also overwrite the old open file data with the new file data, removing the old file data from the store
				const newFileData: OpenFileData = {
					...prevFileData,
					id: uniqueId(),
					filePath,
					window: { ...prevFileData.window, lastActive: Date.now() },
					lastModified,
					unsavedChanges: false,
				}

				// Update the file in our open files
				this.mainManager.store.openFiles.create(newFileData, 'save-as')

				// Update the file in our recent files
				this.mainManager.store.recentFiles.create(
					this.mainManager.openFileDataToRecentFileData(newFileData),
					'save-as-recent-file'
				)

				// this feels a little hacky...
				const window = this.mainManager.windows.getWindowForFileData(newFileData)
				if (!window) throw new Error('Window not found')

				this.mainManager.events.sendMainEventToRenderer(window, {
					type: 'file-path-change',
					payload: { id: newFileData.id, filePath },
				})

				await fs.writeFile(filePath, stringifiedTldrFileData, 'utf-8')

				// Start watching the new file
				this.mainManager.fileWatcher.watchFile(newFileData.id, filePath)

				this.mainManager.windows.createEditorInOldEditorWindow(newFileData)

				return { success: true }
			} catch (err: unknown) {
				return { success: false, error: err instanceof Error ? err.message : String(err) }
			}
		}

		return { success: false, error: 'cancelled' }
	}
}
