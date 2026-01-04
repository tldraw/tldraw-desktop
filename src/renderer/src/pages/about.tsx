import { TitleBar } from '@renderer/components/Titlebar'
import { TldrawLogo } from '@renderer/components/tldraw-logo'

export function Component() {
	return (
		<div className="about__layout">
			<TitleBar />
			<div className="about__content">
				<section className="about__hero">
					<TldrawLogo className="home__logo" />
					<span className="about__version">Version {__APP_VERSION__}</span>
				</section>

				<section className="about__section">
					<p className="about__description">
						A desktop app for creating and editing .tldr files offline. Built with the{' '}
						<a href="https://tldraw.dev" target="_blank" rel="noopener noreferrer">
							tldraw SDK
						</a>
						.
					</p>
				</section>
			</div>
			<Footer />
		</div>
	)
}

function Footer() {
	return (
		<div className="about__footer">
			<a href="https://tldraw.dev" target="_blank" rel="noopener noreferrer">
				{new Date().getFullYear()} © tldraw
			</a>
		</div>
	)
}
