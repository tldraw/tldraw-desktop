import { ElectronAPI } from '@electron-toolkit/preload'
import { MutableRefObject } from 'react'
import { Api } from 'src/types'
import { Editor } from 'tldraw'

declare global {
	interface Window {
		electron: ElectronAPI
		api: Api
		tldraw: {
			editor: Editor
			lastModifiedRef?: MutableRefObject<number>
			persist?: () => void
		}
	}
}
