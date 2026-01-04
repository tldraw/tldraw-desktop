import lz from 'lz-string'
import { useCallback, useEffect, useRef } from 'react'
import { EditorMenuState } from 'src/types'
import { copyAs, Editor, exportAs, react, TLGroupShape, TLShapeId } from 'tldraw'

/**
 * Computes the current editor state for menu item enabled/disabled states.
 */
function computeEditorMenuState(editor: Editor): EditorMenuState {
	const selectedIds = editor.getSelectedShapeIds()
	const selectedShapes = editor.getSelectedShapes()

	// Check if any selected shape is locked
	const hasSelection = selectedIds.length > 0
	const unlockedSelectedIds = selectedShapes
		.filter((shape) => !editor.isShapeOrAncestorLocked(shape))
		.map((shape) => shape.id)
	const hasUnlockedSelection = unlockedSelectedIds.length > 0
	const hasMultipleUnlockedSelection = unlockedSelectedIds.length >= 2

	// Check if any selected shape is a group
	const hasGroupSelected = selectedShapes.some((shape) =>
		editor.isShapeOfType<TLGroupShape>(shape, 'group')
	)

	const instanceState = editor.getInstanceState()

	return {
		hasSelection,
		hasUnlockedSelection,
		hasMultipleUnlockedSelection,
		hasGroupSelected,
		canUndo: editor.getCanUndo(),
		canRedo: editor.getCanRedo(),
		isGridMode: instanceState.isGridMode,
		isSnapMode: editor.user.getIsSnapMode(),
		isToolLocked: instanceState.isToolLocked,
		isFocusMode: instanceState.isFocusMode,
		isDebugMode: instanceState.isDebugMode,
	}
}

/**
 * Handles copy to clipboard using tldraw format.
 * Based on tldraw's handleNativeOrMenuCopy function.
 */
async function handleCopy(editor: Editor): Promise<void> {
	if (editor.getSelectedShapeIds().length === 0) return

	const content = await editor.resolveAssetsInContent(
		editor.getContentFromCurrentPage(editor.getSelectedShapeIds())
	)
	if (!content) {
		navigator.clipboard?.writeText('')
		return
	}

	// Use versioned clipboard format (version 3)
	const { assets, ...otherData } = content
	const clipboardData = {
		type: 'application/tldraw',
		kind: 'content',
		version: 3,
		data: {
			assets: assets || [],
			otherCompressed: lz.compressToBase64(JSON.stringify(otherData)),
		},
	}

	const stringifiedClipboard = JSON.stringify(clipboardData)

	// Extract text from shapes for plain text clipboard
	const textItems = content.shapes
		.map((shape) => {
			const util = editor.getShapeUtil(shape)
			return util.getText(shape)
		})
		.filter((text): text is string => text !== undefined)

	if (navigator.clipboard?.write) {
		const htmlBlob = new Blob([`<div data-tldraw>${stringifiedClipboard}</div>`], {
			type: 'text/html',
		})

		let textContent = textItems.join(' ')
		if (textContent === '') {
			textContent = ' '
		}

		await navigator.clipboard.write([
			new ClipboardItem({
				'text/html': htmlBlob,
				'text/plain': new Blob([textContent], { type: 'text/plain' }),
			}),
		])
	} else if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(`<div data-tldraw>${stringifiedClipboard}</div>`)
	}
}

/**
 * Handles paste from clipboard.
 * Based on tldraw's handlePasteFromClipboardApi function.
 */
async function handlePaste(editor: Editor): Promise<void> {
	// If editing a shape, don't handle paste
	if (editor.getEditingShapeId() !== null) return

	try {
		const clipboardItems = await navigator.clipboard.read()
		await handlePasteFromClipboardItems(editor, clipboardItems)
	} catch (e) {
		console.error('Failed to paste:', e)
	}
}

/**
 * Process clipboard items for pasting.
 */
async function handlePasteFromClipboardItems(
	editor: Editor,
	clipboardItems: ClipboardItem[]
): Promise<void> {
	// Try to find tldraw content first
	for (const item of clipboardItems) {
		if (item.types.includes('text/html')) {
			const blob = await item.getType('text/html')
			const html = await blob.text()

			// Look for tldraw data in HTML
			const match = html.match(/data-tldraw[^>]*>([^<]+)</)
			if (match) {
				try {
					const jsonStr = match[1]
					const json = JSON.parse(jsonStr)

					if (json.type === 'application/tldraw' && json.kind === 'content') {
						let data
						if (json.version === 3) {
							// Version 3: assets are plain, other data is compressed
							const otherData = JSON.parse(lz.decompressFromBase64(json.data.otherCompressed))
							data = { ...otherData, assets: json.data.assets }
						} else if (json.version === 2) {
							data = json.data
						} else {
							data = typeof json.data === 'string' ? JSON.parse(json.data) : json.data
						}

						editor.markHistoryStoppingPoint('paste')
						editor.putExternalContent({ type: 'tldraw', content: data })
						return
					}
				} catch {
					// Failed to parse, continue to other formats
				}
			}
		}
	}

	// Try plain text
	for (const item of clipboardItems) {
		if (item.types.includes('text/plain')) {
			const blob = await item.getType('text/plain')
			const text = await blob.text()

			if (text.trim()) {
				// Check if it's a URL
				try {
					const url = new URL(text)
					if (url.protocol === 'http:' || url.protocol === 'https:') {
						editor.markHistoryStoppingPoint('paste')
						editor.putExternalContent({
							type: 'url',
							url: text,
							point: editor.getViewportPageBounds().center,
						})
						return
					}
				} catch {
					// Not a URL, treat as text
				}

				editor.markHistoryStoppingPoint('paste')
				editor.putExternalContent({
					type: 'text',
					text: text,
					point: editor.getViewportPageBounds().center,
				})
				return
			}
		}
	}

	// Try images
	for (const item of clipboardItems) {
		for (const type of item.types) {
			if (type.startsWith('image/')) {
				const blob = await item.getType(type)
				const file = new File([blob], 'pasted-image', { type })

				editor.markHistoryStoppingPoint('paste')
				editor.putExternalContent({
					type: 'files',
					files: [file],
					point: editor.getViewportPageBounds().center,
				})
				return
			}
		}
	}
}

/**
 * Hook that handles native menu events from the main process.
 * Sets up IPC listeners for all menu actions and syncs editor state back to main.
 */
export function useNativeMenuHandlers(editor: Editor | null): void {
	const lastStateRef = useRef<EditorMenuState | null>(null)

	// Send menu state updates to main process
	const sendMenuState = useCallback((state: EditorMenuState) => {
		const lastState = lastStateRef.current
		if (lastState && JSON.stringify(lastState) === JSON.stringify(state)) {
			return // No change
		}
		lastStateRef.current = state
		window.api.sendRendererEventToMain('editor-menu-state-changed', { state })
	}, [])

	// Subscribe to editor state changes
	useEffect(() => {
		if (!editor) return

		// Send initial state
		sendMenuState(computeEditorMenuState(editor))

		// Listen for changes
		const cleanup = react('menu state sync', () => {
			sendMenuState(computeEditorMenuState(editor))
		})

		return cleanup
	}, [editor, sendMenuState])

	// Set up menu action handlers
	useEffect(() => {
		if (!editor) return

		const cleanups: (() => void)[] = []

		// Edit actions
		cleanups.push(
			window.api.onMainEvent('menu-undo', () => {
				editor.undo()
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-redo', () => {
				editor.redo()
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-cut', async () => {
				if (editor.getSelectedShapeIds().length === 0) return
				editor.markHistoryStoppingPoint('cut')
				await handleCopy(editor)
				editor.deleteShapes(editor.getSelectedShapeIds())
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-copy', async () => {
				await handleCopy(editor)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-paste', async () => {
				await handlePaste(editor)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-duplicate', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('duplicate')
				editor.duplicateShapes(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-delete', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('delete')
				editor.deleteShapes(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-select-all', () => {
				editor.markHistoryStoppingPoint('select all')
				editor.selectAll()
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-select-none', () => {
				editor.markHistoryStoppingPoint('select none')
				editor.selectNone()
			})
		)

		// Shape operations
		cleanups.push(
			window.api.onMainEvent('menu-group', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length < 2) return
				editor.markHistoryStoppingPoint('group')
				editor.groupShapes(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-ungroup', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('ungroup')
				editor.ungroupShapes(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-toggle-lock', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('toggle lock')
				editor.toggleLock(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-unlock-all', () => {
				const allShapes = editor.getCurrentPageShapes()
				const lockedShapes = allShapes.filter((shape) => shape.isLocked)
				if (lockedShapes.length === 0) return
				editor.markHistoryStoppingPoint('unlock all')
				editor.updateShapes(
					lockedShapes.map((shape) => ({ id: shape.id, type: shape.type, isLocked: false }))
				)
			})
		)

		// Arrange
		cleanups.push(
			window.api.onMainEvent('menu-bring-to-front', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('bring to front')
				editor.bringToFront(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-bring-forward', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('bring forward')
				editor.bringForward(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-send-backward', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('send backward')
				editor.sendBackward(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-send-to-back', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('send to back')
				editor.sendToBack(ids)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-flip-horizontal', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('flip horizontal')
				editor.flipShapes(ids, 'horizontal')
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-flip-vertical', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('flip vertical')
				editor.flipShapes(ids, 'vertical')
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-rotate-cw', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('rotate clockwise')
				editor.rotateShapesBy(ids, Math.PI / 2)
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-rotate-ccw', () => {
				const ids = editor.getSelectedShapeIds()
				if (ids.length === 0) return
				editor.markHistoryStoppingPoint('rotate counter-clockwise')
				editor.rotateShapesBy(ids, -Math.PI / 2)
			})
		)

		// Zoom
		cleanups.push(
			window.api.onMainEvent('menu-zoom-in', () => {
				editor.zoomIn()
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-zoom-out', () => {
				editor.zoomOut()
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-zoom-to-100', () => {
				editor.resetZoom()
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-zoom-to-fit', () => {
				editor.zoomToFit()
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-zoom-to-selection', () => {
				if (editor.getSelectedShapeIds().length === 0) return
				editor.zoomToSelection()
			})
		)

		// Export
		cleanups.push(
			window.api.onMainEvent('menu-export-svg', () => {
				const ids = getExportIds(editor)
				exportAs(editor, ids, { format: 'svg' })
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-export-png', () => {
				const ids = getExportIds(editor)
				exportAs(editor, ids, { format: 'png' })
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-copy-as-svg', () => {
				const ids = getExportIds(editor)
				copyAs(editor, ids, { format: 'svg' })
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-copy-as-png', () => {
				const ids = getExportIds(editor)
				copyAs(editor, ids, { format: 'png' })
			})
		)

		// Insert
		cleanups.push(
			window.api.onMainEvent('menu-insert-embed', () => {
				// Open embed dialog - this requires tldraw's dialog system
				// For now, use a prompt
				const url = window.prompt('Enter embed URL:')
				if (url) {
					editor.markHistoryStoppingPoint('insert embed')
					editor.putExternalContent({
						type: 'url',
						url,
						point: editor.getViewportPageBounds().center,
					})
				}
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-insert-media', async () => {
				// Create a file input and trigger it
				const input = document.createElement('input')
				input.type = 'file'
				input.multiple = true
				input.accept = 'image/*,video/*,.gif,.svg'

				input.onchange = async () => {
					const files = Array.from(input.files || [])
					if (files.length === 0) return

					editor.markHistoryStoppingPoint('insert media')
					editor.putExternalContent({
						type: 'files',
						files,
						point: editor.getViewportPageBounds().center,
					})
				}

				input.click()
			})
		)

		// Preferences (toggles)
		cleanups.push(
			window.api.onMainEvent('menu-toggle-grid', () => {
				editor.updateInstanceState({ isGridMode: !editor.getInstanceState().isGridMode })
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-toggle-snap-mode', () => {
				editor.user.updateUserPreferences({ isSnapMode: !editor.user.getIsSnapMode() })
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-toggle-tool-lock', () => {
				editor.updateInstanceState({ isToolLocked: !editor.getInstanceState().isToolLocked })
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-toggle-focus-mode', () => {
				editor.updateInstanceState({ isFocusMode: !editor.getInstanceState().isFocusMode })
			})
		)

		cleanups.push(
			window.api.onMainEvent('menu-toggle-debug-mode', () => {
				editor.updateInstanceState({ isDebugMode: !editor.getInstanceState().isDebugMode })
			})
		)

		return () => {
			cleanups.forEach((cleanup) => cleanup())
		}
	}, [editor])
}

/**
 * Get shape IDs to export - selected shapes if any, otherwise all shapes on page.
 */
function getExportIds(editor: Editor): TLShapeId[] {
	const selectedIds = editor.getSelectedShapeIds()
	if (selectedIds.length > 0) {
		return selectedIds
	}
	return Array.from(editor.getCurrentPageShapeIds())
}
