import { useEffect, useRef } from 'react'
import { Editor, RecordId, TLDocument } from 'tldraw'

/**
 * Hook that provides a persist function for explicit saves.
 *
 * With patch-based sync, we no longer need polling. The persist function is only
 * needed for explicit save operations (Cmd+S) to update document metadata before
 * serializing to file.
 */
export function useEditorPersistence(editor: Editor | null, id: string): void {
	const lastModifiedRef = useRef(-1)

	// Expose persist function for save requests - store in window.tldraw
	useEffect(() => {
		if (!editor) return

		// Store refs on window.tldraw so save handlers can access them
		if (window.tldraw) {
			window.tldraw.lastModifiedRef = lastModifiedRef

			// Persist function for explicit saves
			window.tldraw.persist = () => {
				lastModifiedRef.current = Date.now()
				persist(editor, id, lastModifiedRef.current)
			}
		}

		return () => {
			if (window.tldraw) {
				window.tldraw.persist = undefined
				window.tldraw.lastModifiedRef = undefined
			}
		}
	}, [editor, id])
}

function persist(editor: Editor, id: string, lastModified: number): void {
	const documentRecord = editor.store.get('document:document' as RecordId<TLDocument>)
	if (!documentRecord) {
		console.error('Document record not found during persist')
		return
	}

	// Update the last modified time in document metadata
	editor.store.mergeRemoteChanges(() => {
		editor.store.put([
			{
				...documentRecord,
				meta: { ...documentRecord.meta, desktop: { id, lastModified } },
			},
		])
	})

	// For explicit saves, we send the full snapshot via editor-update
	// The main process uses this for the actual file save operation
	const snapshot = editor.store.getStoreSnapshot()
	window.api.sendRendererEventToMain('editor-update', { id, snapshot, lastModified })
}
