import { BrowserWindow, IpcMainInvokeEvent, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import {
	MainEvent,
	MainInvoke,
	MainInvokePayload,
	MainInvokeResponse,
	RendererEvent,
	RendererEventHandler,
} from 'src/types'
import { MainManager } from './MainManager'

interface InvokeResponseMessage {
	requestId: string
	success: boolean
	response?: unknown
	error?: string
}

export class EventManager {
	private disposals: ((...args: any) => void)[] = []
	private pendingInvokes = new Map<
		string,
		{ resolve: (value: unknown) => void; reject: (error: Error) => void }
	>()

	constructor(readonly mainManager: MainManager) {}

	async initialize() {
		this.dispose()
		ipcMain.handle('renderer-event', this.handleRendererEvent)
		ipcMain.on('main-invoke-response', this.handleInvokeResponse)
	}

	/**
	 * Dispose of all disposals
	 */
	async dispose() {
		this.rendererEventHandlers = {}
		this.disposals.forEach((fn) => fn())
		this.disposals = []
		// Reject any pending invokes
		for (const [, pending] of this.pendingInvokes) {
			pending.reject(new Error('EventManager disposed'))
		}
		this.pendingInvokes.clear()
	}

	private rendererEventHandlers: {
		[K in RendererEvent['type']]?: RendererEventHandler<K>
	} = {}

	private handleRendererEvent = (_: IpcMainInvokeEvent, info: RendererEvent) => {
		const handler = this.rendererEventHandlers[info.type]
		if (!handler) return
		return handler(info.payload as any)
	}

	/**
	 * Send an event to all renderers. The event can be subscribed to by the renderer using `onMainEvent`.
	 * @param event - The event to send
	 */
	sendMainEventToAllRenderers = (event: MainEvent): void => {
		for (const window of BrowserWindow.getAllWindows()) {
			this.sendMainEventToRenderer(window, event)
		}
	}

	/**
	 * Send an event to a specific renderer. The event can be subscribed to by the renderer using `onMainEvent`.
	 * @param window - The window to send the event to
	 * @param event - The event to send
	 */
	sendMainEventToRenderer = (window: BrowserWindow, event: MainEvent): void => {
		if (window.isDestroyed()) return
		window.webContents.send('main-event', event)
	}

	/**
	 * Listen for an event from the renderer. The event can be sent from the renderer using `sendRendererEventToMain`.
	 * @param callback - The callback to call when the event is received
	 */
	onRendererEvent = <T extends RendererEvent['type']>(
		eventName: T,
		callback: RendererEventHandler<T>
	) => {
		this.rendererEventHandlers[eventName] = callback as any
	}

	/**
	 * Handle invoke responses from renderer processes
	 */
	private handleInvokeResponse = (_: unknown, message: InvokeResponseMessage) => {
		const pending = this.pendingInvokes.get(message.requestId)
		if (pending) {
			this.pendingInvokes.delete(message.requestId)
			if (message.success) {
				pending.resolve(message.response)
			} else {
				pending.reject(new Error(message.error ?? 'Unknown error'))
			}
		}
	}

	/**
	 * Invoke a handler in the renderer and await the response.
	 * @param window - The window to invoke the handler in
	 * @param type - The invoke type
	 * @param payload - The payload to send
	 * @returns A promise that resolves with the response
	 */
	invokeRenderer = async <T extends MainInvoke['type']>(
		window: BrowserWindow,
		type: T,
		payload: MainInvokePayload<T>
	): Promise<MainInvokeResponse<T>> => {
		if (window.isDestroyed()) {
			throw new Error('Window is destroyed')
		}

		const requestId = randomUUID()

		return new Promise((resolve, reject) => {
			this.pendingInvokes.set(requestId, {
				resolve: resolve as (value: unknown) => void,
				reject,
			})

			window.webContents.send('main-invoke', { requestId, type, payload })

			// Timeout after 30 seconds
			setTimeout(() => {
				if (this.pendingInvokes.has(requestId)) {
					this.pendingInvokes.delete(requestId)
					reject(new Error('Invoke timed out'))
				}
			}, 30000)
		})
	}
}
