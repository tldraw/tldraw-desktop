import { TitleBar } from './Titlebar'

interface ErrorDisplayProps {
	error?: string
	stack?: string
}

export function ErrorDisplay({ error, stack }: ErrorDisplayProps) {
	const isDev = import.meta.env.DEV

	return (
		<div className="error__layout">
			<TitleBar />
			<div className="error__container">
				<h1 className="error__heading">Something went wrong</h1>
				{isDev && error && <p className="error__message">{error}</p>}
				{isDev && stack && <pre className="error__stack">{stack}</pre>}
				<div className="error__actions">
					<button className="error__button" onClick={() => (window.location.href = '/home')}>
						Go Home
					</button>
					<button className="error__button" onClick={() => window.location.reload()}>
						Reload
					</button>
				</div>
			</div>
		</div>
	)
}
