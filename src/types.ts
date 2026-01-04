import { RecordsDiff, SerializedSchema, StoreSnapshot, TLRecord } from 'tldraw'

// Events that are sent from the main process to the renderer
export type MainEvent =
	| {
			type: 'open-files-change'
			payload: {
				openFiles: OpenFileData[]
				reason: string
			}
	  }
	| {
			type: 'recent-files-change'
			payload: {
				recentFiles: RecentFileData[]
				reason: string
			}
	  }
	| {
			type: 'user-preferences-change'
			payload: {
				userPreferences: AppStoreSchema['userPreferences']
				reason: string
			}
	  }
	| {
			type: 'file-path-change'
			payload: {
				id: string
				filePath: string
			}
	  }
	| {
			type: 'home-info-ready'
			payload: {
				recentFiles: RecentFileData[]
				userPreferences: AppStoreSchema['userPreferences']
			}
	  }
	| {
			type: 'editor-info-ready'
			payload: {
				id: string
				fileData: OpenFileData
				userPreferences: AppStoreSchema['userPreferences']
			}
	  }
	| {
			type: 'window-focus'
			payload: Record<string, never>
	  }
	| {
			type: 'window-blur'
			payload: Record<string, never>
	  }
	| {
			type: 'document-patch'
			payload: {
				documentId: string
				changes: RecordsDiff<TLRecord>
				originWindowId: number
				sequence: number
			}
	  }
	| {
			type: 'document-sync-state'
			payload: {
				documentId: string
				snapshot: StoreSnapshot<TLRecord>
				sequence: number
			}
	  }
	| {
			type: 'document-dirty-change'
			payload: {
				documentId: string
				unsavedChanges: boolean
			}
	  }
	// Menu actions (main -> renderer)
	| { type: 'menu-undo'; payload: Record<string, never> }
	| { type: 'menu-redo'; payload: Record<string, never> }
	| { type: 'menu-cut'; payload: Record<string, never> }
	| { type: 'menu-copy'; payload: Record<string, never> }
	| { type: 'menu-paste'; payload: Record<string, never> }
	| { type: 'menu-duplicate'; payload: Record<string, never> }
	| { type: 'menu-delete'; payload: Record<string, never> }
	| { type: 'menu-select-all'; payload: Record<string, never> }
	| { type: 'menu-select-none'; payload: Record<string, never> }
	| { type: 'menu-group'; payload: Record<string, never> }
	| { type: 'menu-ungroup'; payload: Record<string, never> }
	| { type: 'menu-toggle-lock'; payload: Record<string, never> }
	| { type: 'menu-unlock-all'; payload: Record<string, never> }
	| { type: 'menu-bring-to-front'; payload: Record<string, never> }
	| { type: 'menu-bring-forward'; payload: Record<string, never> }
	| { type: 'menu-send-backward'; payload: Record<string, never> }
	| { type: 'menu-send-to-back'; payload: Record<string, never> }
	| { type: 'menu-flip-horizontal'; payload: Record<string, never> }
	| { type: 'menu-flip-vertical'; payload: Record<string, never> }
	| { type: 'menu-rotate-cw'; payload: Record<string, never> }
	| { type: 'menu-rotate-ccw'; payload: Record<string, never> }
	| { type: 'menu-zoom-in'; payload: Record<string, never> }
	| { type: 'menu-zoom-out'; payload: Record<string, never> }
	| { type: 'menu-zoom-to-100'; payload: Record<string, never> }
	| { type: 'menu-zoom-to-fit'; payload: Record<string, never> }
	| { type: 'menu-zoom-to-selection'; payload: Record<string, never> }
	| { type: 'menu-export-svg'; payload: Record<string, never> }
	| { type: 'menu-export-png'; payload: Record<string, never> }
	| { type: 'menu-copy-as-svg'; payload: Record<string, never> }
	| { type: 'menu-copy-as-png'; payload: Record<string, never> }
	| { type: 'menu-insert-embed'; payload: Record<string, never> }
	| { type: 'menu-insert-media'; payload: Record<string, never> }
	| { type: 'menu-toggle-grid'; payload: Record<string, never> }
	| { type: 'menu-toggle-snap-mode'; payload: Record<string, never> }
	| { type: 'menu-toggle-tool-lock'; payload: Record<string, never> }
	| { type: 'menu-toggle-focus-mode'; payload: Record<string, never> }
	| { type: 'menu-toggle-debug-mode'; payload: Record<string, never> }

// Events that are sent from the renderer to the main process
export type RendererEvent =
	| {
			type: 'home-loaded'
			payload: Record<string, never>
	  }
	| {
			type: 'home-ready-to-show'
			payload: Record<string, never>
	  }
	| {
			type: 'home-new-file'
			payload: Record<string, never>
	  }
	| {
			type: 'home-open-file'
			payload: Record<string, never>
	  }
	| {
			type: 'home-open-recent-file'
			payload: {
				filePath: string
			}
	  }
	| {
			type: 'editor-loaded'
			payload: {
				id: string
			}
	  }
	| {
			type: 'editor-ready-to-show'
			payload: {
				id: string
			}
	  }
	| {
			type: 'editor-user-preferences-change'
			payload: Partial<AppStoreSchema['userPreferences']>
	  }
	| {
			type: 'editor-new-file'
			payload: Record<string, never>
	  }
	| {
			type: 'editor-open-file'
			payload: Record<string, never>
	  }
	| {
			type: 'editor-save-file'
			payload: Record<string, never>
	  }
	| {
			type: 'editor-save-as-file'
			payload: Record<string, never>
	  }
	| {
			type: 'editor-rename-file'
			payload: Record<string, never>
	  }
	| {
			type: 'editor-update'
			payload: {
				id: string
				snapshot: StoreSnapshot<TLRecord>
				lastModified: number
			}
	  }
	| {
			type: 'show-home'
			payload: Record<string, never>
	  }
	| {
			type: 'window-focus'
			payload: Record<string, never>
	  }
	| {
			type: 'window-blur'
			payload: Record<string, never>
	  }
	| {
			type: 'editor-patch'
			payload: {
				documentId: string
				changes: RecordsDiff<TLRecord>
				schema: SerializedSchema
				windowId: number
			}
	  }
	| {
			type: 'editor-sync-register'
			payload: {
				documentId: string
				windowId: number
			}
	  }
	| {
			type: 'editor-sync-unregister'
			payload: {
				documentId: string
				windowId: number
			}
	  }
	| {
			type: 'editor-menu-state-changed'
			payload: {
				state: EditorMenuState
			}
	  }
	// Window control events (renderer -> main)
	| { type: 'window-control-close'; payload: Record<string, never> }
	| { type: 'window-control-minimize'; payload: Record<string, never> }
	| { type: 'window-control-maximize'; payload: Record<string, never> }

export interface EditorMenuState {
	hasSelection: boolean
	hasUnlockedSelection: boolean
	hasMultipleUnlockedSelection: boolean
	hasGroupSelected: boolean
	canUndo: boolean
	canRedo: boolean
	isGridMode: boolean
	isSnapMode: boolean
	isToolLocked: boolean
	isFocusMode: boolean
	isDebugMode: boolean
}

export type RendererEventHandler<T extends RendererEvent['type']> = (
	info: Extract<RendererEvent, { type: T }>['payload']
) => Promise<void>

// Main process can invoke these on the renderer and await a response
export type MainInvoke =
	| {
			type: 'editor-save'
			payload: { id: string; closing?: boolean }
			response: { serializedTldrFileData: string; lastModified: number }
	  }
	| {
			type: 'editor-save-as'
			payload: { id: string }
			response: { serializedTldrFileData: string; lastModified: number }
	  }

// Helper types for type safety
export type MainInvokePayload<T extends MainInvoke['type']> = Extract<
	MainInvoke,
	{ type: T }
>['payload']

export type MainInvokeResponse<T extends MainInvoke['type']> = Extract<
	MainInvoke,
	{ type: T }
>['response']

export interface Api {
	sendRendererEventToMain<T extends RendererEvent>(
		eventName: T['type'],
		payload: T['payload']
	): void
	onMainEvent<T extends MainEvent['type']>(
		eventName: T,
		callback: (info: Extract<MainEvent, { type: T }>['payload']) => void
	): () => void
	onMainInvoke<T extends MainInvoke['type']>(
		invokeName: T,
		handler: (payload: MainInvokePayload<T>) => Promise<MainInvokeResponse<T>>
	): () => void
}

export interface OpenFileData {
	// The file's unique id
	id: string
	// The last time the file was modified
	lastModified: number
	// The last time the file was opened
	lastOpened: number
	// The window that the file is open in
	window: {
		id: number
		lastActive: number
		bounds: Electron.Rectangle
		displayId: number
	}
	// Where the file is stored. A file may be unsaved, in which case it will not have a filePath.
	filePath: string | null
	// Whether the file has unsaved changes since its last save (if any)
	unsavedChanges: boolean
	// The file's content
	content: StoreSnapshot<TLRecord>
}

export interface RecentFileData {
	// The file's unique id
	id: string
	// The last time the file was modified
	lastModified: number
	// The last time the file was opened
	lastOpened: number
	// The window that the file was open in
	window: {
		id: number
		lastActive: number
		bounds: Electron.Rectangle
		displayId: number
	}
	// Where the file is stored. A recent file will always have a filePath.
	filePath: string
}

export interface TldrFileData {
	tldrawFileFormatVersion: number
	records: TLRecord[]
	schema: SerializedSchema
}

export type FileData = OpenFileData | RecentFileData

export type ActionResult =
	| {
			success: true
	  }
	| {
			success: false
			error: string
	  }

export interface AppStoreSchema {
	version: string
	openFiles: Record<number, OpenFileData> // windowId -> file data
	recentFiles: Record<string, RecentFileData> // data of recently opened files
	userPreferences: {
		theme: 'light' | 'dark'
		isGridMode: boolean
		isToolLocked: boolean
		exportBackground: boolean
		autoCheckUpdates: boolean
	}
	featureFlags: Record<string, never>
}

// Schema for the new per-file storage format (config.json)
export interface ConfigSchema {
	version: string
	userPreferences: {
		theme: 'light' | 'dark'
		isGridMode: boolean
		isToolLocked: boolean
		exportBackground: boolean
		autoCheckUpdates: boolean
	}
	featureFlags: Record<string, never>
}

// Schema for the recent files storage (recent-files.json)
export interface RecentFilesSchema {
	version: string
	files: Record<string, RecentFileData>
}
