import { electronApp } from '@electron-toolkit/utils'
import dotenv from 'dotenv'
import { app } from 'electron'
import { MainManager } from './MainManager'

dotenv.config()

if (process.argv.includes('--playwright')) {
	// Enable remote debugging
	app.commandLine.appendSwitch('remote-debugging-port', '9222')
	// Disable background timer throttling to prevent the window from being hidden when the window is occluded
	app.commandLine.appendSwitch('disable-background-timer-throttling')
	// Disable backgrounding occluded windows to prevent the window from being hidden when the window is occluded
	app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
	// Disable renderer backgrounding to prevent the renderer from being killed when the window is occluded
	app.commandLine.appendSwitch('disable-renderer-backgrounding')
}

app.whenReady().then(async () => {
	// Set app user model id for windows
	electronApp.setAppUserModelId('com.electron')

	const mainManager = new MainManager(app)
	await mainManager.initialize()
})
