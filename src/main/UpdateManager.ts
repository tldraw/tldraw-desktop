import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { MainManager } from './MainManager'

export class UpdateManager {
	private isManualCheck = false
	private isCheckingForUpdates = false

	constructor(public mainManager: MainManager) {
		// Configure auto updater
		autoUpdater.autoDownload = false
		autoUpdater.autoInstallOnAppQuit = true

		// Add this line for private repos
		if (process.env.GH_TOKEN) {
			autoUpdater.setFeedURL({
				provider: 'github',
				owner: 'tldraw',
				repo: 'tldraw-desktop',
				private: true,
				token: process.env.GH_TOKEN,
			})
		}

		this.setupUpdateHandlers()
	}

	async dispose() {}

	async initialize() {
		if (process.env.NODE_ENV === 'development') {
			// In development, read update configuration from dev-app-update.yml
			autoUpdater.updateConfigPath = 'dev-app-update.yml'
			// Force updates in dev mode when GH_TOKEN is present
			if (process.env.GH_TOKEN) {
				autoUpdater.forceDevUpdateConfig = true
			}
		}

		// Check if user has auto-updates enabled
		const userPrefs = this.mainManager.store.getUserPreferences()
		if (userPrefs.autoCheckUpdates) {
			try {
				await this.checkForUpdates(false) // false = background check
			} catch (error) {
				console.error('Error checking for updates:', error)
			}
		}
	}

	private setupUpdateHandlers() {
		autoUpdater.on('checking-for-update', () => {
			this.isCheckingForUpdates = true
		})

		autoUpdater.on('update-available', async (info) => {
			// Don't recursively call checkForUpdates - the update is already available
			// Just prompt user for download
			const activeWindow = BrowserWindow.getFocusedWindow()
			if (!activeWindow) {
				// For background checks without a focused window, skip the prompt
				if (!this.isManualCheck) {
					this.isCheckingForUpdates = false
					return
				}
				// For manual checks, use the first available window
				const windows = BrowserWindow.getAllWindows()
				if (windows.length === 0) {
					this.isCheckingForUpdates = false
					this.isManualCheck = false
					return
				}
			}

			const targetWindow = activeWindow || BrowserWindow.getAllWindows()[0]

			const promptResult = await dialog.showMessageBox(targetWindow, {
				type: 'info',
				title: 'Update Available',
				message: `A new version (${info.version}) of tldraw is available. Would you like to download it now?`,
				buttons: ['Download', 'Later'],
				defaultId: 0,
			})

			if (promptResult.response === 0) {
				autoUpdater.downloadUpdate()
			} else {
				this.isCheckingForUpdates = false
				this.isManualCheck = false
			}
		})

		autoUpdater.on('update-not-available', async () => {
			if (this.isManualCheck) {
				const activeWindow = BrowserWindow.getFocusedWindow()
				const targetWindow = activeWindow || BrowserWindow.getAllWindows()[0]
				if (targetWindow) {
					dialog.showMessageBox(targetWindow, {
						type: 'info',
						title: 'No Updates Available',
						message: `You're running the latest version (${app.getVersion()}).`,
						buttons: ['OK'],
					})
				}
			}
			this.isCheckingForUpdates = false
			this.isManualCheck = false
		})

		autoUpdater.on('update-downloaded', async (info) => {
			const activeWindow = BrowserWindow.getFocusedWindow()
			const targetWindow = activeWindow || BrowserWindow.getAllWindows()[0]
			if (!targetWindow) {
				this.isCheckingForUpdates = false
				this.isManualCheck = false
				return
			}

			const result = await dialog.showMessageBox(targetWindow, {
				type: 'info',
				title: 'Update Ready',
				message: `Version ${info.version} has been downloaded. The application will now restart to install the update.`,
				buttons: ['Restart', 'Later'],
				defaultId: 0,
			})

			if (result.response === 0) {
				autoUpdater.quitAndInstall()
			}

			this.isCheckingForUpdates = false
			this.isManualCheck = false
		})

		autoUpdater.on('error', (error) => {
			console.error('Update error:', error)

			if (this.isManualCheck) {
				const activeWindow = BrowserWindow.getFocusedWindow()
				const targetWindow = activeWindow || BrowserWindow.getAllWindows()[0]
				if (targetWindow) {
					dialog.showMessageBox(targetWindow, {
						type: 'error',
						title: 'Update Error',
						message: 'Failed to check for updates. Please try again later.',
						detail: error.message,
						buttons: ['OK'],
					})
				}
			}
			this.isCheckingForUpdates = false
			this.isManualCheck = false
		})
	}

	// Method to manually check for updates
	async checkForUpdates(manual = false) {
		if (this.isCheckingForUpdates) {
			// If already checking and this is a manual check, inform the user
			if (manual) {
				const activeWindow = BrowserWindow.getFocusedWindow()
				if (activeWindow) {
					dialog.showMessageBox(activeWindow, {
						type: 'info',
						title: 'Checking for Updates',
						message: 'Already checking for updates, please wait...',
						buttons: ['OK'],
					})
				}
			}
			return
		}

		this.isManualCheck = manual
		this.isCheckingForUpdates = true

		await autoUpdater.checkForUpdates()
	}
}
