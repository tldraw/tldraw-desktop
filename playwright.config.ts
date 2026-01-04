import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export default defineConfig({
	testDir: './e2e',
	use: {
		headless: true,
		viewport: { width: 1280, height: 720 },
		// Capture trace and video on first retry for debugging flaky tests
		trace: 'on-first-retry',
		video: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	timeout: 30000,
	workers: 1, // Run tests sequentially
	fullyParallel: false,
	// Retry flaky tests once (Electron window focus can be unreliable)
	retries: 1,
	preserveOutput: 'failures-only', // Keep artifacts only for failed tests
	outputDir: '.playwright-results', // Store results in a hidden directory
	reporter: process.env.CI
		? [['dot'], ['html', { outputFolder: '.playwright-results/html-report', open: 'never' }]]
		: 'list',
	globalSetup: fileURLToPath(new URL('./e2e/global-setup.ts', import.meta.url)),
	globalTeardown: fileURLToPath(new URL('./e2e/global-teardown.ts', import.meta.url)),
})
