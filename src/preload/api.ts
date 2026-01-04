import { ipcRenderer, IpcRendererEvent } from 'electron/renderer'
import { Api, MainEvent } from '../types'

// Increase max listeners to accommodate all event subscriptions per editor window
// Each editor window subscribes to ~10-12 different events
ipcRenderer.setMaxListeners(20)

// Track registered invoke handlers
const mainInvokeHandlers = new Map<string, (payload: unknown) => Promise<unknown>>()

// Set up invoke listener once
ipcRenderer.on(
	'main-invoke',
	async (_, { requestId, type, payload }: { requestId: string; type: string; payload: unknown }) => {
		const handler = mainInvokeHandlers.get(type)
		if (handler) {
			try {
				const response = await handler(payload)
				ipcRenderer.send('main-invoke-response', { requestId, success: true, response })
			} catch (error) {
				ipcRenderer.send('main-invoke-response', {
					requestId,
					success: false,
					error: error instanceof Error ? error.message : String(error),
				})
			}
		} else {
			ipcRenderer.send('main-invoke-response', {
				requestId,
				success: false,
				error: `No handler registered for invoke type: ${type}`,
			})
		}
	}
)

// Custom APIs for renderer
export const api: Api = {
	sendRendererEventToMain(eventName, payload) {
		return ipcRenderer.invoke('renderer-event', { type: eventName, payload })
	},
	onMainEvent(eventName, callback) {
		function handler(_: IpcRendererEvent, info: MainEvent) {
			if (info.type === eventName) {
				// Type assertion needed because TypeScript can't narrow the union type here
				callback(info.payload as never)
			}
		}
		ipcRenderer.on('main-event', handler)
		return () => ipcRenderer.off('main-event', handler)
	},
	onMainInvoke(invokeName, handler) {
		mainInvokeHandlers.set(invokeName, handler as (payload: unknown) => Promise<unknown>)
		return () => {
			mainInvokeHandlers.delete(invokeName)
		}
	},
}
