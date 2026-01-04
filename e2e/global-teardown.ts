import { rm } from 'fs/promises'
import { TEST_DATA_DIR } from './e2e-globals'

export default async function globalSetup() {
	try {
		// Create a temporary folder for all tests (ie. /tldraw-test-data)
		return await rm(TEST_DATA_DIR, { recursive: true, force: true })
	} catch (err) {
		console.error(`Failed to create test data directory: ${TEST_DATA_DIR}`, err)
		throw err
	}
}
