import { TitleBar } from '@renderer/components/Titlebar'

export function Component() {
	return (
		<div className="license__layout">
			<TitleBar />
			<div className="license__content">
				<section className="license__section">
					<h1>tldraw desktop</h1>
					<p className="license__intro">
						This application uses the tldraw SDK and several open-source libraries. Below are the
						licenses for the major dependencies.
					</p>
				</section>

				<section className="license__section">
					<h2>tldraw SDK</h2>
					<p className="license__note">
						The tldraw SDK is proprietary software with a tiered license model.
					</p>
					<ul className="license__list">
						<li>Development and personal use is free</li>
						<li>Commercial use requires a paid license</li>
					</ul>
					<p className="license__note">
						For full license terms, visit:{' '}
						<a
							href="https://github.com/tldraw/tldraw/blob/main/LICENSE.md"
							target="_blank"
							rel="noopener noreferrer"
						>
							https://github.com/tldraw/tldraw/blob/main/LICENSE.md
						</a>
					</p>
				</section>

				<section className="license__section">
					<h2>Electron</h2>
					<LicenseText license={MIT_ELECTRON} />
				</section>

				<section className="license__section">
					<h2>React</h2>
					<LicenseText license={MIT_REACT} />
				</section>
			</div>
			<Footer />
		</div>
	)
}

function LicenseText({ license }: { license: string }) {
	return <pre className="license__text">{license}</pre>
}

function Footer() {
	return (
		<div className="license__footer">
			<a href="https://tldraw.dev" target="_blank" rel="noopener noreferrer">
				{new Date().getFullYear()} © tldraw
			</a>
		</div>
	)
}

const MIT_ELECTRON = `MIT License

Copyright (c) Electron contributors
Copyright (c) GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

const MIT_REACT = `MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
