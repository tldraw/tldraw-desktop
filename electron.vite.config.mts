import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { resolve } from 'path'
import pkg from './package.json'

export default defineConfig({
	main: {
		build: {
			minify: false,
			externalizeDeps: {
				exclude: ['electron-updater'],
			},
		},
	},
	preload: {
		build: {
			minify: false,
			rollupOptions: {
				output: {
					format: 'cjs',
					entryFileNames: '[name].cjs',
				},
			},
		},
	},
	renderer: {
		define: {
			__APP_VERSION__: JSON.stringify(pkg.version),
			__APP_NAME__: JSON.stringify(pkg.productName),
		},
		resolve: {
			alias: {
				'@renderer': resolve('src/renderer/src'),
			},
		},
		plugins: [react()],
		build: {
			minify: false,
			rollupOptions: {
				output: {
					manualChunks: {
						'react-vendor': ['react', 'react-dom'],
						'tldraw-vendor': ['tldraw'],
					},
				},
			},
		},
	},
})
