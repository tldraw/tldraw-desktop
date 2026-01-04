import classNames from 'classnames'
import { useCallback, useEffect, useState } from 'react'

export function WindowControls() {
	const [isWindowFocused, setIsWindowFocused] = useState(true)

	useEffect(() => {
		function handleFocus() {
			setIsWindowFocused(true)
		}
		function handleBlur() {
			setIsWindowFocused(false)
		}
		const cleanupFns = [
			window.api.onMainEvent('window-focus', handleFocus),
			window.api.onMainEvent('window-blur', handleBlur),
		]
		return () => {
			cleanupFns.forEach((fn) => fn())
		}
	}, [])

	const handleClose = useCallback(() => {
		window.api.sendRendererEventToMain('window-control-close', {})
	}, [])

	const handleMinimize = useCallback(() => {
		window.api.sendRendererEventToMain('window-control-minimize', {})
	}, [])

	const handleMaximize = useCallback(() => {
		window.api.sendRendererEventToMain('window-control-maximize', {})
	}, [])

	return (
		<div
			className={classNames('editor__titlebar__window-controls', {
				'window-controls-focused': isWindowFocused,
			})}
		>
			<button
				className="editor__titlebar__window-control editor__titlebar__window-control--close"
				onClick={handleClose}
				aria-label="Close"
			/>
			<button
				className="editor__titlebar__window-control editor__titlebar__window-control--minimize"
				onClick={handleMinimize}
				aria-label="Minimize"
			/>
			<button
				className="editor__titlebar__window-control editor__titlebar__window-control--maximize"
				onClick={handleMaximize}
				aria-label="Maximize"
			/>
		</div>
	)
}
