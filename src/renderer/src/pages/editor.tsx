import { EditorMenuPanel } from '@renderer/components/EditorMenuPanel'
import {
	filePathAtom,
	unsavedChangesAtom,
	userPreferencesAtom,
} from '@renderer/components/sharedAtoms'
import { useDocumentSync } from '@renderer/hooks/useDocumentSync'
import { useEditorDarkModeSync } from '@renderer/hooks/useEditorDarkModeSync'
import { useEditorPersistence } from '@renderer/hooks/useEditorPersistence'
import { useNativeMenuHandlers } from '@renderer/hooks/useNativeMenuHandlers'
import { useUserPreferences } from '@renderer/hooks/useUserPreferences'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { OpenFileData } from 'src/types'
import {
	createTLStore,
	Editor,
	RecordId,
	serializeTldrawJson,
	TLComponents,
	TLDocument,
	Tldraw,
	TldrawOptions,
	TLStoreWithStatus,
	TLUiOverrides,
} from 'tldraw'

export function Component() {
	const [initialFileData, setInitialFileData] = useState<OpenFileData | null>(null)
	const { id } = useParams() as { id: string }
	const lastModifiedRef = useRef(-1)

	useUserPreferences()

	useEffect(() => {
		if (id === 'PRELOAD') {
			return
		}
		// When the api knows we're loaded, it will send a 'editor-info-ready' event
		const cleanups = [
			window.api.onMainEvent('editor-info-ready', ({ fileData, userPreferences }) => {
				// We'll set our app's state using the info we get from the main process
				setInitialFileData(fileData)
				lastModifiedRef.current = fileData.lastModified
				if (fileData.filePath) {
					filePathAtom.set(fileData.filePath)
				}
				unsavedChangesAtom.set(fileData.unsavedChanges)
				userPreferencesAtom.set(userPreferences)
			}),
			window.api.onMainEvent('document-dirty-change', ({ documentId, unsavedChanges }) => {
				if (documentId === id) {
					unsavedChangesAtom.set(unsavedChanges)
				}
			}),
			// Use awaitable invoke handlers for save operations
			window.api.onMainInvoke('editor-save', async ({ id: requestedId }) => {
				if (id !== requestedId) throw new Error('ID mismatch')
				// Ensure we persist latest state before serializing
				window.tldraw.persist?.()
				const serializedTldrFileData = await serializeTldrawJson(window.tldraw.editor)
				return {
					serializedTldrFileData,
					lastModified: window.tldraw.lastModifiedRef?.current ?? lastModifiedRef.current,
				}
			}),
			window.api.onMainInvoke('editor-save-as', async ({ id: requestedId }) => {
				if (id !== requestedId) throw new Error('ID mismatch')
				// Ensure we persist latest state before serializing
				window.tldraw.persist?.()
				const serializedTldrFileData = await serializeTldrawJson(window.tldraw.editor)
				return {
					serializedTldrFileData,
					lastModified: window.tldraw.lastModifiedRef?.current ?? lastModifiedRef.current,
				}
			}),
			// Whenever the open files change, we'll update the file data for this editor
			window.api.onMainEvent('file-path-change', ({ id: _id, filePath }) => {
				if (_id === id) {
					filePathAtom.set(filePath)
				}
			}),
		]

		// 1. Tell the main process that we're ready to load the editor page
		window.api.sendRendererEventToMain('editor-loaded', { id })
		return () => {
			cleanups.forEach((fn) => fn())
		}
	}, [id])

	if (id === 'PRELOAD' || !initialFileData) {
		return <PreloadedTldrawEditorView key={id} />
	}

	return (
		<TldrawEditorView
			key={id}
			id={id}
			initialFileData={initialFileData}
			initialLastModified={lastModifiedRef.current}
		/>
	)
}

const components: TLComponents = {
	MainMenu: null, // Hide tldraw's hamburger menu - all actions are in native Electron menu
	TopPanel: null, // Title is now in MenuPanel
	MenuPanel: EditorMenuPanel, // Custom panel with title + page menu
}

const overrides: TLUiOverrides = {
	actions(_editor, actions) {
		// File operations - these trigger IPC to the main process
		actions['save-file'] = {
			id: 'save-file',
			label: 'action.save-file',
			kbd: '$s',
			onSelect() {
				window.api.sendRendererEventToMain('editor-save-file', {})
			},
		}
		actions['save-file-as'] = {
			id: 'save-file-as',
			label: 'action.save-file-as',
			kbd: '$!s',
			onSelect() {
				window.api.sendRendererEventToMain('editor-save-as-file', {})
			},
		}
		actions['new-file'] = {
			id: 'new-file',
			label: 'action.new-file',
			kbd: '$n',
			onSelect() {
				window.api.sendRendererEventToMain('editor-new-file', {})
			},
		}
		actions['open-file'] = {
			id: 'open-file',
			label: 'action.open-file',
			kbd: '$o',
			onSelect() {
				window.api.sendRendererEventToMain('editor-open-file', {})
			},
		}
		return actions
	},
}

const options: Partial<TldrawOptions> = {
	actionShortcutsLocation: 'toolbar',
}

const PreloadedTldrawEditorView = () => {
	// Create a fresh store each time to ensure no state contamination
	// This is important because tldraw may cache state internally
	const [store] = useState(() => createTLStore())

	return (
		<div className="editor__layout">
			<div className="editor__tldraw" style={{ opacity: 0 }}>
				<Tldraw
					store={store}
					overrides={overrides}
					components={components}
					options={options}
					autoFocus
				/>
			</div>
		</div>
	)
}

const TldrawEditorView = memo<{
	id: string
	initialFileData: OpenFileData
	initialLastModified: number
}>(function TldrawEditorView({ id, initialFileData, initialLastModified }) {
	const [ready, setReady] = useState(false)
	const [editor, setEditor] = useState<Editor | null>(null)

	const syncResult = useDocumentSync({
		snapshot: initialFileData.content,
		documentId: id,
	})
	const { setWindowId, ...storeWithStatus } = syncResult
	// Cast to TLStoreWithStatus - the syncResult contains the same structure
	const store = storeWithStatus as TLStoreWithStatus

	// Use new hooks instead of Sneaky components
	useEditorPersistence(editor, id)
	useEditorDarkModeSync(editor)
	useNativeMenuHandlers(editor)

	const handleMount = useCallback(
		(mountedEditor: Editor) => {
			// Put editor in the window
			window.tldraw = { editor: mountedEditor }

			try {
				filePathAtom.set(initialFileData.filePath)
			} catch (error) {
				console.error('Failed to set file path atom:', error)
			}

			const lastModified = initialLastModified > 0 ? initialLastModified : Date.now()

			// Stash the id of this document in the meta of the document record so that we can reconnect it to desktop open / recent file data
			// Use mergeRemoteChanges so this doesn't trigger patch sync (it's initialization, not user change)
			const documentRecord = mountedEditor.store.get('document:document' as RecordId<TLDocument>)
			if (!documentRecord) throw Error('Document record not found')
			mountedEditor.store.mergeRemoteChanges(() => {
				mountedEditor.store.put([
					{
						...documentRecord,
						meta: { ...documentRecord.meta, desktop: { id, lastModified } },
					},
				])
			})

			// Register this window with the sync manager
			setWindowId(initialFileData.window.id)

			setEditor(mountedEditor)
			setReady(true)
			window.api.sendRendererEventToMain('editor-ready-to-show', { id: initialFileData.id })
		},
		[
			id,
			initialFileData.filePath,
			initialFileData.id,
			initialFileData.window.id,
			initialLastModified,
			setWindowId,
		]
	)

	// Cleanup window.tldraw on unmount
	useEffect(() => {
		return () => {
			// @ts-expect-error - Clearing global for cleanup
			window.tldraw = undefined
		}
	}, [])

	return (
		<div className="editor__layout">
			<div className="editor__tldraw" style={{ opacity: ready ? 1 : 0 }}>
				<Tldraw
					store={store}
					overrides={overrides}
					components={components}
					onMount={handleMount}
					options={options}
					autoFocus
				/>
			</div>
		</div>
	)
})
