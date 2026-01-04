import { _electron, test as base, ElectronApplication, expect, Page } from '@playwright/test'
import { existsSync } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { uniqueId } from 'tldraw'
import { TEST_DATA_DIR } from './e2e-globals'
import { stubMessageBox } from './helpers'
import { HomePOM } from './poms/home-pom'

type TestFixtures = {
	homePom: HomePOM
	app: ElectronApplication
	homeWindow: Page
}

export function setupTestFile() {
	const test = base.extend<TestFixtures>({
		app: async ({}, use) => {
			const id = uniqueId()
			let app: ElectronApplication | undefined

			try {
				const testDataDir = join(TEST_DATA_DIR, id)
				if (existsSync(testDataDir)) {
					console.log('removing subdirectory')
					await rm(testDataDir, { recursive: true, force: true })
				}

				// Create a subfolder inside of our temporary folder for this file's tests (ie. /tldraw-test-data/123)
				await mkdir(testDataDir, { recursive: true })
				if (!existsSync(testDataDir)) {
					throw Error('Failed to create test data directory')
				}

				app = await _electron.launch({
					args: ['./out/main/index.js', '--playwright'],
					env: {
						TEST_DATA_DIR: testDataDir,
					},
				})

				app.on('console', (msg) => {
					console.log(msg.text())
				})

				await new Promise((resolve) => {
					app?.on('console', (msg) => {
						if (msg.text().includes('home-window-show')) {
							resolve(true)
						}
					})
				})

				const win = await app.firstWindow()
				console.log('starting at', win.url())

				// Stub the "Do you want to save?" dialog to auto-click "Don't Save"
				// This prevents state contamination from blocking tests
				await stubMessageBox(app, 1) // 1 = "Don't Save" button

				await use(app)

				// Stub the "Do you want to save?" dialog to auto-click "Don't Save" during teardown
				// This prevents dialogs from blocking window close when tests leave dirty state
				await stubMessageBox(app, 1) // 1 = "Don't Save" button

				// Close all non-home windows first
				const windows = app.windows()
				for (const win of windows) {
					if (!win.url().includes('home') && !win.isClosed()) {
						await win.close()
					}
				}

				// Explicitly quit the Electron app to avoid force-quit timeout on macOS
				// (On macOS, the app stays alive when windows are closed, so app.close()
				// would wait for a timeout before force-killing)
				await app.evaluate(({ app }) => app.quit())

				await app.close()
			} catch (err: any) {
				console.error(err)
				throw err
			} finally {
				if (app) {
					await app.close()
				}
				// Now remove our subfolder
				await rm(join(TEST_DATA_DIR, id), { recursive: true, force: true })
			}
		},
		homeWindow: async ({ app }, use) => {
			await use(await app.firstWindow())
		},
		homePom: async ({ app }, use) => {
			const home = new HomePOM(app, app.windows().find((w) => w.url().includes('home'))!)
			if (!home) throw Error('Home window not found')
			await home.waitForReady()
			await use(home)
		},
	})

	return {
		test,
		expect,
	}
}
