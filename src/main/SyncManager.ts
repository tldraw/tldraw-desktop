import { BrowserWindow } from 'electron'
import { RecordsDiff, SerializedSchema, StoreSnapshot, TLRecord } from 'tldraw'
import { MainManager } from './MainManager'

/**
 * SyncManager coordinates document sync between multiple windows.
 *
 * It acts as a hub that:
 * - Tracks which windows have each document open
 * - Receives patches from renderers and applies them to stored snapshots
 * - Broadcasts patches to other windows viewing the same document
 * - Sends full state to late-joining windows
 */
export class SyncManager {
	// Map of documentId -> Set of windowIds that have the document open
	private documentWindows = new Map<string, Set<number>>()

	// Sequence numbers per document for ordering patches
	private sequenceNumbers = new Map<string, number>()

	constructor(public mainManager: MainManager) {}

	dispose() {
		this.documentWindows.clear()
		this.sequenceNumbers.clear()
	}

	/**
	 * Register a window as viewing a document.
	 * If this is the first window for the document, it's already synced.
	 * If there are other windows, send the current state to the new window.
	 */
	registerWindow(documentId: string, windowId: number): void {
		if (!this.documentWindows.has(documentId)) {
			this.documentWindows.set(documentId, new Set())
			this.sequenceNumbers.set(documentId, 0)
		}

		const windows = this.documentWindows.get(documentId)!

		// If there are already windows viewing this document, send current state to new window
		if (windows.size > 0) {
			const fileData = this.mainManager.store.openFiles.get(documentId)
			if (fileData) {
				const window = this.mainManager.windows.get(windowId)
				if (window) {
					this.mainManager.events.sendMainEventToRenderer(window, {
						type: 'document-sync-state',
						payload: {
							documentId,
							snapshot: fileData.content,
							sequence: this.sequenceNumbers.get(documentId)!,
						},
					})
				}
			}
		}

		windows.add(windowId)
	}

	/**
	 * Unregister a window from a document.
	 * Called when a window is closed or navigates away from a document.
	 */
	unregisterWindow(documentId: string, windowId: number): void {
		const windows = this.documentWindows.get(documentId)
		if (windows) {
			windows.delete(windowId)
			if (windows.size === 0) {
				this.documentWindows.delete(documentId)
				this.sequenceNumbers.delete(documentId)
			}
		}
	}

	/**
	 * Handle an incoming patch from a renderer.
	 * - Apply the patch to the stored snapshot
	 * - Broadcast the patch to other windows viewing the same document
	 */
	handlePatch(
		documentId: string,
		changes: RecordsDiff<TLRecord>,
		_schema: SerializedSchema,
		originWindowId: number
	): void {
		// Apply patch to stored snapshot
		const fileData = this.mainManager.store.openFiles.get(documentId)
		if (!fileData) return

		const updatedSnapshot = this.applyPatchToSnapshot(fileData.content, changes)

		// Update the stored snapshot and notify about dirty state change
		this.mainManager.store.updateOpenFileWithDirtyNotification(
			{
				id: documentId,
				lastModified: Date.now(),
				unsavedChanges: true,
				content: updatedSnapshot,
			},
			'editor-patch'
		)

		// Increment sequence number
		const sequence = (this.sequenceNumbers.get(documentId) ?? 0) + 1
		this.sequenceNumbers.set(documentId, sequence)

		// Broadcast to other windows viewing the same document
		this.broadcastPatch(documentId, changes, originWindowId, sequence)
	}

	/**
	 * Apply a RecordsDiff patch to a StoreSnapshot.
	 * Returns a new snapshot with the patch applied.
	 */
	private applyPatchToSnapshot(
		snapshot: StoreSnapshot<TLRecord>,
		diff: RecordsDiff<TLRecord>
	): StoreSnapshot<TLRecord> {
		// Create a shallow copy of the store records
		const store = { ...snapshot.store }

		// Add new records
		for (const [id, record] of Object.entries(diff.added)) {
			store[id as keyof typeof store] = record
		}

		// Update existing records (use the 'to' value from the [from, to] tuple)
		for (const [id, [, to]] of Object.entries(diff.updated)) {
			store[id as keyof typeof store] = to
		}

		// Remove deleted records
		for (const id of Object.keys(diff.removed)) {
			delete store[id as keyof typeof store]
		}

		return {
			...snapshot,
			store,
		}
	}

	/**
	 * Broadcast a patch to all windows viewing a document except the origin window.
	 */
	private broadcastPatch(
		documentId: string,
		changes: RecordsDiff<TLRecord>,
		originWindowId: number,
		sequence: number
	): void {
		const windows = this.documentWindows.get(documentId)
		if (!windows) return

		for (const windowId of windows) {
			// Don't send the patch back to the window that originated it
			if (windowId === originWindowId) continue

			const window = BrowserWindow.fromId(windowId)
			if (window && !window.isDestroyed()) {
				this.mainManager.events.sendMainEventToRenderer(window, {
					type: 'document-patch',
					payload: {
						documentId,
						changes,
						originWindowId,
						sequence,
					},
				})
			}
		}
	}

	/**
	 * Get all window IDs that have a specific document open.
	 */
	getWindowsForDocument(documentId: string): number[] {
		const windows = this.documentWindows.get(documentId)
		return windows ? Array.from(windows) : []
	}

	/**
	 * Check if a document has multiple windows viewing it.
	 */
	hasMultipleWindows(documentId: string): boolean {
		const windows = this.documentWindows.get(documentId)
		return windows ? windows.size > 1 : false
	}
}
