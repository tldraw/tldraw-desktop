import { useCallback, useEffect, useRef } from 'react'
import {
	createTLStore,
	RecordsDiff,
	SerializedSchema,
	TLEditorSnapshot,
	TLRecord,
	TLStore,
	TLStoreOptions,
	TLStoreSnapshot,
	TLStoreWithStatus,
} from 'tldraw'
import { useRefState } from './useRefState'

/**
 * ElectronSyncClient handles patch-based sync between renderer and main process.
 *
 * It:
 * - Listens to store changes and sends patches via IPC
 * - Receives patches from main process (originating from other windows)
 * - Applies incoming patches using mergeRemoteChanges
 * - Filters out self-originated patches using windowId
 */
export class ElectronSyncClient {
	private disposables = new Set<() => void>()
	private didDispose = false
	private windowId: number | null = null
	// Sequence number tracking for ordering patches (reserved for future use)
	// @ts-expect-error - Reserved for future ordering/conflict resolution
	private lastSequence = 0

	readonly serializedSchema: SerializedSchema

	constructor(
		public readonly store: TLStore,
		public readonly documentId: string,
		{
			onLoad,
		}: {
			onLoad(self: ElectronSyncClient): void
		}
	) {
		this.serializedSchema = this.store.schema.serialize()

		// Listen to store changes and send patches to main process
		this.disposables.add(
			store.listen(
				({ changes }) => {
					if (this.didDispose) return
					if (this.windowId === null) return // Not yet registered

					window.api.sendRendererEventToMain('editor-patch', {
						documentId: this.documentId,
						changes: changes as RecordsDiff<TLRecord>,
						schema: this.serializedSchema,
						windowId: this.windowId,
					})
				},
				{ source: 'user', scope: 'document' }
			)
		)

		// Listen for incoming patches from other windows
		const unsubscribePatch = window.api.onMainEvent('document-patch', (payload) => {
			if (this.didDispose) return
			if (payload.documentId !== this.documentId) return
			// Don't apply our own patches
			if (payload.originWindowId === this.windowId) return

			this.lastSequence = payload.sequence
			this.applyPatch(payload.changes)
		})
		this.disposables.add(unsubscribePatch)

		// Listen for full state sync (for late-joining windows)
		const unsubscribeState = window.api.onMainEvent('document-sync-state', (payload) => {
			if (this.didDispose) return
			if (payload.documentId !== this.documentId) return

			this.lastSequence = payload.sequence
			this.applySnapshot(payload.snapshot)
		})
		this.disposables.add(unsubscribeState)

		onLoad(this)
	}

	/**
	 * Set the window ID and register with the sync manager.
	 * Must be called after the window is ready.
	 */
	setWindowId(windowId: number): void {
		this.windowId = windowId
		window.api.sendRendererEventToMain('editor-sync-register', {
			documentId: this.documentId,
			windowId,
		})
	}

	/**
	 * Apply a patch from another window.
	 */
	private applyPatch(changes: RecordsDiff<TLRecord>): void {
		this.store.mergeRemoteChanges(() => {
			// Add new records
			const toAdd: TLRecord[] = Object.values(changes.added)
			if (toAdd.length > 0) {
				this.store.put(toAdd)
			}

			// Update existing records
			const toUpdate: TLRecord[] = Object.values(changes.updated).map(([, to]) => to)
			if (toUpdate.length > 0) {
				this.store.put(toUpdate)
			}

			// Remove deleted records
			const toRemove = Object.keys(changes.removed) as TLRecord['id'][]
			if (toRemove.length > 0) {
				this.store.remove(toRemove)
			}
		})
	}

	/**
	 * Apply a full snapshot (for late-joining windows).
	 */
	private applySnapshot(snapshot: TLStoreSnapshot): void {
		this.store.mergeRemoteChanges(() => {
			// Get current records
			const currentIds = new Set(this.store.allRecords().map((r) => r.id))

			// Add/update records from snapshot
			const records = Object.values(snapshot.store) as TLRecord[]
			this.store.put(records)

			// Remove records that are in current but not in snapshot
			const snapshotIds = new Set(Object.keys(snapshot.store))
			const toRemove = [...currentIds].filter((id) => !snapshotIds.has(id)) as TLRecord['id'][]
			if (toRemove.length > 0) {
				this.store.remove(toRemove)
			}
		})
	}

	close(): void {
		this.didDispose = true

		// Unregister from sync
		if (this.windowId !== null) {
			window.api.sendRendererEventToMain('editor-sync-unregister', {
				documentId: this.documentId,
				windowId: this.windowId,
			})
		}

		this.disposables.forEach((d) => d())
	}
}

export type UseDocumentSyncOptions = TLStoreOptions & {
	snapshot?: TLEditorSnapshot | TLStoreSnapshot
	documentId: string
}

export type UseDocumentSyncResult = TLStoreWithStatus & {
	setWindowId: (windowId: number) => void
}

export function useDocumentSync(options: UseDocumentSyncOptions): UseDocumentSyncResult {
	const [state, setState] = useRefState<TLStoreWithStatus>({ status: 'loading' })

	// Store options in a ref to avoid re-running effect on every render
	// The snapshot and documentId should only be used on initial mount
	const optionsRef = useRef(options)

	// Store the client ref so setWindowId can access it
	const clientRef = useRef<ElectronSyncClient | null>(null)

	useEffect(() => {
		const store = createTLStore(optionsRef.current)

		let isClosed = false

		const client = new ElectronSyncClient(store, optionsRef.current.documentId, {
			onLoad() {
				if (isClosed) return
				setState({ store, status: 'synced-local' })
			},
		})

		clientRef.current = client

		return () => {
			isClosed = true
			clientRef.current = null
			client.close()
		}
	}, [setState])

	const setWindowId = useCallback((windowId: number) => {
		clientRef.current?.setWindowId(windowId)
	}, [])

	return {
		...state,
		setWindowId,
	}
}
