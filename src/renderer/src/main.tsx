import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router'
import 'tldraw/tldraw.css'
import { ThemeContainer } from './components/ThemeContainer'
import './index.css'
import { router } from './routes'

const browserRouter = createHashRouter(router)

window.electron.ipcRenderer.on('window-focus', () => {
	window.api.sendRendererEventToMain('window-focus', {})
})

window.electron.ipcRenderer.on('window-blur', () => {
	window.api.sendRendererEventToMain('window-blur', {})
})

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ThemeContainer>
			<RouterProvider router={browserRouter} />
		</ThemeContainer>
	</React.StrictMode>
)
