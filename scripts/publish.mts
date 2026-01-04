import { createAppAuth } from '@octokit/auth-app'
import { execSync } from 'child_process'
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'

function checkEnv() {
	// Check that all the environment variables are set
	const requiredKeys = [
		'GH_TOKEN',
		'GH_APP_ID',
		'GH_INSTALLATION_ID',
		'APPLE_ID',
		'APPLE_APP_SPECIFIC_PASSWORD',
		'APPLE_TEAM_ID',
	]

	for (const key of requiredKeys) {
		if (!process.env[key]) {
			console.error(`No ${key} found in environment`)
			process.exit(1)
		}
	}
}

async function setupFolder() {
	// delete the existing dist folder / any built files
	await fs.rm(path.join(process.cwd(), 'dist'), { recursive: true, force: true })
}

async function generateToken() {
	// Generate a GH token for the app
	const privateKey = await fs.readFile(
		path.join(process.cwd(), './tldraw-desktop.2025-01-04.private-key.pem'),
		'utf-8'
	)

	const auth = createAppAuth({
		appId: Number(process.env.GH_APP_ID),
		privateKey,
		installationId: Number(process.env.GH_INSTALLATION_ID),
	})

	const { token } = await auth({ type: 'installation' })

	process.env.GH_TOKEN = token

	// Write the token to the .env file, replacing its existing value
	const envFile = path.join(process.cwd(), '.env')
	const envFileContents = await fs.readFile(envFile, 'utf-8')
	await fs.writeFile(envFile, envFileContents.replace(/GH_TOKEN=.+/, `GH_TOKEN=${token}`))
}

async function publish() {
	// Build the app and publish it to GitHub
	execSync('electron-builder -p always', {
		stdio: 'inherit',
		env: process.env,
	})
}

async function main() {
	checkEnv()
	console.log('Setting up dist folder...')
	await setupFolder()
	console.log('Generating token...')
	await generateToken()
	console.log('Publishing...')
	await publish()
}

await main()
