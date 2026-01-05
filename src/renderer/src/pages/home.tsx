import { ChevronRightIcon } from '@renderer/components/ChevronRightIcon'
import { Kbd } from '@renderer/components/Kbd'
import { TitleBar } from '@renderer/components/Titlebar'
import { TldrawLogo } from '@renderer/components/tldraw-logo'
import { useRecentFiles } from '@renderer/hooks/useRecentFiles'
import classNames from 'classnames'
import { useEffect, useLayoutEffect, useState } from 'react'

export function Component() {
	// useLayoutEffect ensures all child component effects (like useRecentFiles listener)
	// are registered before we send home-loaded, preventing a race condition where
	// the home-info-ready response arrives before listeners are attached
	useLayoutEffect(() => {
		// When the api knows we're loaded, it will send a 'home-info-ready' event
		const cleanup = window.api.onMainEvent('home-info-ready', () => {
			window.api.sendRendererEventToMain('home-ready-to-show', {})
		})
		// Tell the main process that we're ready to load the home page
		window.api.sendRendererEventToMain('home-loaded', {})
		return () => {
			cleanup()
		}
	}, [])

	return (
		<div className="home__layout">
			<TitleBar />
			<div className="home__container">
				<TldrawLogo className="home__logo" />
				<MainButtons />
				<RecentFiles />
			</div>
			<Copyright />
		</div>
	)
}

function MainButtons() {
	return (
		<div className="home__section home__main-buttons">
			<button
				className="home__button"
				onClick={() => window.api.sendRendererEventToMain('home-new-file', {})}
			>
				New File <Kbd>$N</Kbd>
			</button>
			<button
				className="home__button"
				onClick={() => window.api.sendRendererEventToMain('home-open-file', {})}
			>
				Open File... <Kbd>$O</Kbd>
			</button>
		</div>
	)
}

function RecentFiles() {
	const recentFiles = useRecentFiles()

	const [showFilePaths, setShowFilePaths] = useState(false)

	useEffect(() => {
		let accelerator = false

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Alt' || e.key === 'Option') {
				accelerator = true
				setShowFilePaths(true)
			}
		}

		function onKeyUp(e: KeyboardEvent) {
			if (e.key === 'Alt' || e.key === 'Option') {
				if (accelerator) {
					accelerator = false
					setShowFilePaths(false)
				}
			}
		}
		window.addEventListener('keyup', onKeyUp)
		window.addEventListener('keydown', onKeyDown)
		return () => {
			window.removeEventListener('keyup', onKeyUp)
			window.removeEventListener('keydown', onKeyDown)
		}
	}, [])

	return (
		<div className="home__section home__recent">
			<hr />
			<h3>Recent files</h3>
			{recentFiles
				.filter((f) => f.filePath)
				.slice(0, 5)
				.map((f) => {
					// remove the /users/username/ from the file path
					const pathParts = f.filePath!.split('/').slice(3)
					const fileName = pathParts.pop()
					return (
						<button
							className="home__button home__button__file"
							key={f.filePath}
							onClick={() => {
								window.api.sendRendererEventToMain('home-open-recent-file', {
									filePath: f.filePath!,
								})
							}}
						>
							<div className="home__file-path-container" data-paths={showFilePaths}>
								<div
									className={classNames('home__file-path', {
										'home__file-path-visible': showFilePaths,
										'home__file-path-hidden': !showFilePaths,
									})}
								>
									~/{pathParts.join('/')}/
								</div>
								<div className="home__file-name">{fileName}</div>
							</div>
							<ChevronRightIcon />
						</button>
					)
				})}
		</div>
	)
}

function Copyright() {
	return (
		<div className="home__copyright">
			<a href="https://tldraw.dev" target="_blank">
				{new Date().getFullYear()} © tldraw
			</a>
		</div>
	)
}
