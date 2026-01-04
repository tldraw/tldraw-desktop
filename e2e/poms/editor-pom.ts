import { ElectronApplication, expect } from '@playwright/test'
import { createShapeId, Editor, TLShapeId } from 'tldraw'
import { BasePOM } from './base-pom'

/** Console message emitted when an editor window is created */
const EDITOR_WINDOW_CONSOLE_MESSAGE = 'editor-window-created'

/** Default timeout for shape-related operations */
const SHAPE_OPERATION_TIMEOUT = 1000

export class EditorPOM extends BasePOM {
	// ============ Locators ============

	/** Get the main canvas element */
	getCanvas() {
		return this.page.locator('.tl-canvas')
	}


	/** Get the toolbar element */
	getToolbar() {
		return this.page.locator('.tlui-toolbar')
	}

	/** Get the style panel element */
	getStylePanel() {
		return this.page.locator('.tlui-style-panel')
	}

	/** Get the title bar element */
	getTitleBar() {
		return this.page.getByTestId('editor__titlebar__title')
	}

	// ============ Lifecycle ============

	override async waitForReady(): Promise<void> {
		await this.page.waitForSelector('.tl-canvas', { state: 'visible' })
	}

	// ============ Shape Operations ============

	/** Get the number of shapes on the current page */
	async getShapeCount(): Promise<number> {
		return await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			return editor.getCurrentPageShapes().length
		})
	}

	/**
	 * Assert the shape count equals a specific value.
	 * Uses polling for reliability after shape operations.
	 * @param count - Expected number of shapes
	 * @param timeout - Maximum wait time in ms (default: 1000)
	 */
	async expectShapeCount(count: number, timeout = SHAPE_OPERATION_TIMEOUT): Promise<void> {
		await expect
			.poll(() => this.getShapeCount(), {
				timeout,
				message: `Expected ${count} shapes on canvas`,
			})
			.toBe(count)
	}

	/** Get the IDs of all shapes on the current page */
	async getShapeIds(): Promise<TLShapeId[]> {
		return (await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			return editor.getCurrentPageShapes().map((s) => s.id)
		})) as TLShapeId[]
	}

	/** Get the IDs of currently selected shapes */
	async getSelectedShapeIds(): Promise<TLShapeId[]> {
		return (await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			return editor.getSelectedShapeIds()
		})) as TLShapeId[]
	}

	/** Get the count of currently selected shapes */
	async getSelectedShapeCount(): Promise<number> {
		const ids = await this.getSelectedShapeIds()
		return ids.length
	}

	/**
	 * Assert the selected shape count equals a specific value.
	 * Uses polling for reliability after selection operations.
	 */
	async expectSelectedShapeCount(count: number, timeout = SHAPE_OPERATION_TIMEOUT): Promise<void> {
		await expect
			.poll(() => this.getSelectedShapeCount(), {
				timeout,
				message: `Expected ${count} selected shapes`,
			})
			.toBe(count)
	}

	/**
	 * Draw a rectangle on the canvas programmatically.
	 * Returns the ID of the created shape.
	 */
	async drawRectangle(x = 100, y = 100, width = 100, height = 100): Promise<TLShapeId> {
		// Generate ID outside of evaluate since createShapeId is not available in browser context
		const id = createShapeId()
		const idStr = id as string
		await this.page.evaluate(
			({ idStr, x, y, width, height }) => {
				const editor = (window as any).tldraw?.editor as Editor
				if (!editor) throw new Error('Editor not found')
				editor.createShape({
					id: idStr as any,
					type: 'geo',
					x,
					y,
					props: {
						w: width,
						h: height,
						geo: 'rectangle',
					},
				})
			},
			{ idStr, x, y, width, height }
		)
		return id
	}

	/**
	 * Draw an ellipse on the canvas programmatically.
	 * Returns the ID of the created shape.
	 */
	async drawEllipse(x = 100, y = 100, width = 100, height = 100): Promise<TLShapeId> {
		const id = createShapeId()
		const idStr = id as string
		await this.page.evaluate(
			({ idStr, x, y, width, height }) => {
				const editor = (window as any).tldraw?.editor as Editor
				if (!editor) throw new Error('Editor not found')
				editor.createShape({
					id: idStr as any,
					type: 'geo',
					x,
					y,
					props: {
						w: width,
						h: height,
						geo: 'ellipse',
					},
				})
			},
			{ idStr, x, y, width, height }
		)
		return id
	}

	/**
	 * Select shapes by their IDs.
	 */
	async selectShapes(ids: TLShapeId[]): Promise<void> {
		const idStrs = ids as string[]
		await this.page.evaluate((idStrs) => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			editor.select(...(idStrs as any[]))
		}, idStrs)
	}

	/**
	 * Select all shapes on the current page.
	 */
	async selectAllShapes(): Promise<void> {
		await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			editor.selectAll()
		})
	}

	/**
	 * Delete the currently selected shapes using editor.deleteShapes().
	 * Note: This may not be recorded in undo history. Use kbds.delete() for undoable deletes.
	 */
	async deleteSelectedShapes(): Promise<void> {
		await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			// Use editor.deleteShapes with the selected IDs
			// Note: For undo support, prefer keyboard delete
			editor.deleteShapes(editor.getSelectedShapeIds())
		})
	}

	/**
	 * Delete the currently selected shapes (undoable).
	 * Uses editor.mark() and editor.deleteShapes() to ensure proper undo support.
	 */
	async deleteSelectedShapesUndoable(): Promise<void> {
		await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			// Mark for undo then delete
			;(editor as any).mark('delete-shapes')
			editor.deleteShapes(editor.getSelectedShapeIds())
		})
	}

	/**
	 * Clear selection.
	 */
	async clearSelection(): Promise<void> {
		await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			editor.selectNone()
		})
	}

	/**
	 * Programmatic undo operation.
	 * More reliable than keyboard shortcuts when the canvas doesn't have focus.
	 */
	async undo(): Promise<void> {
		await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			editor.undo()
		})
	}

	/**
	 * Programmatic redo operation.
	 * More reliable than keyboard shortcuts when the canvas doesn't have focus.
	 */
	async redo(): Promise<void> {
		await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			editor.redo()
		})
	}

	// ============ Tool Operations ============

	/**
	 * Get the currently active tool ID.
	 */
	async getCurrentTool(): Promise<string> {
		return await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			return editor.getCurrentToolId()
		})
	}

	/**
	 * Assert the current tool equals a specific tool ID.
	 * Uses polling for reliability after tool changes.
	 */
	async expectCurrentTool(toolId: string, timeout = 3000): Promise<void> {
		await expect
			.poll(() => this.getCurrentTool(), {
				timeout,
				message: `Expected current tool to be "${toolId}"`,
			})
			.toBe(toolId)
	}

	/**
	 * Keyboard shortcuts for selecting tools.
	 */
	toolKbds = {
		/** Select tool (V) */
		select: async () => {
			await this.page.keyboard.press('V')
		},
		/** Draw/pencil tool (D) */
		draw: async () => {
			await this.page.keyboard.press('D')
		},
		/** Rectangle tool (R) */
		rectangle: async () => {
			await this.page.keyboard.press('R')
		},
		/** Ellipse/oval tool (O) */
		ellipse: async () => {
			await this.page.keyboard.press('O')
		},
		/** Arrow tool (A) */
		arrow: async () => {
			await this.page.keyboard.press('A')
		},
		/** Line tool (L) */
		line: async () => {
			await this.page.keyboard.press('L')
		},
		/** Text tool (T) */
		text: async () => {
			await this.page.keyboard.press('T')
		},
		/** Frame tool (F) */
		frame: async () => {
			await this.page.keyboard.press('F')
		},
		/** Note/sticky tool (N) */
		note: async () => {
			await this.page.keyboard.press('N')
		},
		/** Hand/pan tool (H) */
		hand: async () => {
			await this.page.keyboard.press('H')
		},
		/** Eraser tool (E) */
		eraser: async () => {
			await this.page.keyboard.press('E')
		},
		/** Laser pointer tool (K) */
		laser: async () => {
			await this.page.keyboard.press('K')
		},
	}

	// ============ Document Operations ============

	/**
	 * Get the document ID from the editor store.
	 * This ID is used to identify the document across sessions.
	 */
	async getDocumentId(): Promise<string | undefined> {
		return await this.page.evaluate(() => {
			const editor = (window as any).tldraw?.editor as Editor
			if (!editor) throw new Error('Editor not found')
			const doc = editor.store.get('document:document' as any) as any
			return doc?.meta?.desktop?.id
		})
	}

	/**
	 * Check if the document has unsaved changes (is dirty).
	 */
	async isDirty(): Promise<boolean> {
		// Check if title contains the dirty indicator (bullet point)
		const title = await this.page.getByTestId('editor__titlebar__title').textContent()
		return title?.includes('•') || false
	}

	// ============ Menu Operations ============

	/**
	 * Get the current theme from the page.
	 */
	private async getCurrentTheme(): Promise<'light' | 'dark'> {
		// Check for theme selectors - light theme has .tl-theme__light, dark has .tl-theme__dark
		const isDark = await this.page.locator('.tl-theme__dark').count()
		return isDark > 0 ? 'dark' : 'light'
	}

	menu = {
		save: async () => {
			await this.appMenu.file.save()
		},

		saveAs: async () => {
			await this.appMenu.file.saveAs()
		},

		rename: async () => {
			await this.appMenu.file.rename()
		},

		open: async () => {
			await this.appMenu.file.open()
		},

		new: async () => {
			await this.appMenu.file.new()
		},

		/**
		 * Set the theme to a specific value.
		 * Note: The menu has a "Toggle Theme" option, so this checks the current theme
		 * and toggles if necessary.
		 */
		setTheme: async (theme: 'Dark' | 'Light') => {
			const currentTheme = await this.getCurrentTheme()
			const targetTheme = theme.toLowerCase() as 'dark' | 'light'
			if (currentTheme !== targetTheme) {
				await this.appMenu.file.preferences.theme()
			}
		},

		undo: async () => {
			await this.appMenu.edit.undo()
		},

		redo: async () => {
			await this.appMenu.edit.redo()
		},
	}

	// ============ Assertions ============

	async expectCanvasVisible(): Promise<void> {
		await expect(this.getCanvas()).toBeVisible()
	}

	async expectToolbarVisible(): Promise<void> {
		await expect(this.getToolbar()).toBeVisible()
	}

	/**
	 * Assert that the document has unsaved changes (is dirty).
	 * Uses polling for reliability as dirty state may update asynchronously.
	 */
	async expectDirty(timeout = 1000): Promise<void> {
		await expect
			.poll(() => this.isDirty(), {
				timeout,
				message: 'Editor should show dirty indicator (unsaved changes)',
			})
			.toBe(true)
	}

	/**
	 * Assert that the document has no unsaved changes (is clean).
	 * Uses polling for reliability as dirty state may update asynchronously.
	 */
	async expectClean(timeout = 1000): Promise<void> {
		await expect
			.poll(() => this.isDirty(), {
				timeout,
				message: 'Editor should not show dirty indicator (no unsaved changes)',
			})
			.toBe(false)
	}

	/**
	 * Assert that the editor window is focused.
	 * Uses polling for reliability as focus may change asynchronously.
	 */
	async expectFocused(timeout = 1000, message?: string): Promise<void> {
		await expect
			.poll(() => this.isFocused(), {
				timeout,
				message: message ?? 'Editor window should be focused',
			})
			.toBe(true)
	}

	// ============ Static Factory ============

	/**
	 * Wait for an Editor window to open after executing a callback.
	 * @param app - The Electron application instance
	 * @param cb - Callback that triggers the Editor window to open
	 * @param timeout - Optional timeout in milliseconds
	 */
	static async After(
		app: ElectronApplication,
		cb: () => unknown | Promise<unknown>,
		timeout?: number
	): Promise<EditorPOM> {
		const page = await BasePOM.waitForWindowWithConsoleMessage(
			app,
			EDITOR_WINDOW_CONSOLE_MESSAGE,
			'/f/',
			cb,
			timeout
		)

		const pom = new EditorPOM(app, page)
		await pom.waitForReady()
		return pom
	}
}
