import { memo, useCallback, useRef } from 'react'
import {
	TldrawUiIcon,
	useEditor,
	usePassThroughWheelEvents,
	useTldrawUiComponents,
	useValue,
} from 'tldraw'
import { filePathAtom, unsavedChangesAtom } from './sharedAtoms'
import { WindowControls } from './WindowControls'

export const EditorMenuPanel = memo(function EditorMenuPanel() {
	const filePath = useValue('file path', () => filePathAtom.get(), [])
	const unsavedChanges = useValue('unsaved changes', () => unsavedChangesAtom.get(), [])
	const { PageMenu } = useTldrawUiComponents()
	const editor = useEditor()
	const isSinglePageMode = useValue('isSinglePageMode', () => editor.options.maxPages <= 1, [
		editor,
	])

	const ref = useRef<HTMLDivElement>(null!)
	usePassThroughWheelEvents(ref)

	const handleTitleDoubleClick = useCallback(() => {
		window.api.sendRendererEventToMain('editor-rename-file', {})
	}, [])

	return (
		<div className="editor__menu-panel-container">
			<div ref={ref} className="editor__menu-panel-container-inner"></div>
			<div className="editor__menu-panel">
				{/* Custom window controls */}
				<WindowControls />
				{/* Document title */}
				<TldrawUiIcon icon="drag-handle-dots" label="Drag to move" />
				<div
					className="editor__document-title"
					data-testid="editor__titlebar__title"
					onDoubleClick={handleTitleDoubleClick}
				>
					{filePath ? (
						<>
							<span>{filePath.split('/').at(-1)?.split('.tldr')[0]}</span>
							<span className="editor__title-extension">.tldr</span>
						</>
					) : (
						'Untitled'
					)}
					<span
						className="editor__dirty-indicator"
						data-unsaved={unsavedChanges}
						data-testid="editor__dirty-indicator"
					>
						•
					</span>
				</div>

				{/* Page menu */}
				{PageMenu && !isSinglePageMode && <PageMenu />}
			</div>
		</div>
	)
})
