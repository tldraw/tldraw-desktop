/*
In theory...

1. Bump the version in package.json
2. Publish the app (build, sign, notarize, publish a release)
3. Add release notes to the release
4. Push a tag for the release version
*/

async function main() {
	// const token = await generateToken()
	// process.env.GH_TOKEN = token
	// const publishProcess = spawn('npm', ['run', 'publish'], { env: process.env })
	// publishProcess.stdout.on('data', (data) => {
	// 	console.log(`${data}`)
	// })
	// publishProcess.stderr.on('data', (data) => {
	// 	console.error(`${data}`)
	// })
	// publishProcess.on('close', (code) => {
	// 	console.log(`Child process exited with code ${code}`)
	// })
	// publishProcess.on('error', (error) => {
	// 	console.error(`${error.message}`)
	// })
	// await new Promise((resolve, reject) => {
	// 	exec(
	// 		'npm run publish',
	// 		{
	// 			env: process.env,
	// 		},
	// 		(err, stdout, stderr) => {
	// 			if (err) {
	// 				console.error(err)
	// 				reject(stderr)
	// 			} else {
	// 				resolve(stdout)
	// 			}
	// 		}
	// 	)
	// })
	// // if (!process.env.GH_TOKEN) {
	// // 	throw Error('GH_TOKEN environment variable is required')
	// // }
	// const octokit = new Octokit({
	// 	auth: token,
	// })
	// async function getRelease(versionString: string) {
	// 	const releases = await octokit.rest.repos.listReleases({
	// 		owner: 'tldraw',
	// 		repo: 'tldraw-desktop',
	// 		per_page: 100,
	// 	})
	// 	const release = releases.data.find((release) => release.tag_name === versionString)
	// 	if (!release) {
	// 		throw Error('No release found for this version')
	// 	}
	// 	return release
	// }
	// async function uploadFiles(versionString: string, releaseId: number) {
	// 	// Upload the DMG file and latest-mac.yml
	// 	const outDir = path.join('out', 'make')
	// 	const files = [
	// 		{
	// 			path: path.join(outDir, 'tldraw.dmg'),
	// 			name: `tldraw-${versionString}.dmg`,
	// 			contentType: 'application/x-apple-diskimage',
	// 		},
	// 		{
	// 			path: path.join(outDir, 'latest-mac.yml'),
	// 			name: 'latest-mac.yml',
	// 			contentType: 'application/yaml',
	// 		},
	// 	]
	// 	await Promise.all(
	// 		files.map(async (file) => {
	// 			const fileExists = await fs.stat(file.path).catch(() => false)
	// 			if (!fileExists) {
	// 				throw new Error(`File not found at: ${file.path}`)
	// 			}
	// 			console.log(`Uploading ${file.name}...`)
	// 			const content = await fs.readFile(file.path)
	// 			await octokit.rest.repos.uploadReleaseAsset({
	// 				owner: 'tldraw',
	// 				repo: 'tldraw-desktop',
	// 				release_id: releaseId,
	// 				name: file.name,
	// 				data: content as any,
	// 				headers: {
	// 					'content-type': file.contentType,
	// 					'content-length': content.length,
	// 				},
	// 			})
	// 		})
	// 	)
	// }
	// try {
	// 	// Extract the current version from package.json
	// 	const version = await import('../package.json').then((pkg) => pkg.version)
	// 	if (!version) {
	// 		throw Error('No version found in package.json')
	// 	}
	// 	const versionString = 'v' + version
	// 	console.log('Attempting to release version:', version)
	// 	console.log(`Pushing tag ${versionString}...`)
	// 	try {
	// 		const existingRef = await octokit.rest.git.getRef({
	// 			owner: 'tldraw',
	// 			repo: 'tldraw-desktop',
	// 			ref: `tags/${versionString}`,
	// 		})
	// 		console.log(`Tag ${versionString} already exists, using existing tag`)
	// 	} catch (error) {
	// 		console.log('Tag does not exist, creating...')
	// 		const { data: ref } = await octokit.rest.git.getRef({
	// 			owner: 'tldraw',
	// 			repo: 'tldraw-desktop',
	// 			ref: 'heads/main',
	// 		})
	// 		await octokit.rest.git.createRef({
	// 			owner: 'tldraw',
	// 			repo: 'tldraw-desktop',
	// 			ref: `refs/tags/${versionString}`,
	// 			sha: ref.object.sha,
	// 		})
	// 		console.log(`Tag ${versionString} created`)
	// 	}
	// 	// Extract the release notes from CHANGELOG.md
	// 	const changelog = await fs.readFile('CHANGELOG.md', 'utf8')
	// 	const releaseNotes = changelog.split(`# ${version}`)?.[1]?.trim()
	// 	if (!releaseNotes) {
	// 		throw Error('No release notes found for this version')
	// 	}
	// 	console.log(`Release Notes: ${releaseNotes}`)
	// 	// Build the app
	// 	// remove the dist / build folders
	// 	try {
	// 		await fs.rm(path.join(process.cwd(), 'dist'), { recursive: true, force: true })
	// 	} catch (error) {
	// 		console.log('Dist folder does not exist yet...')
	// 	}
	// 	try {
	// 		await fs.rm(path.join(process.cwd(), 'build'), { recursive: true, force: true })
	// 	} catch (error) {
	// 		console.log('Build folder does not exist yet...')
	// 	}
	// 	// Now make the dist folder
	// 	console.log('Creating dist folder...')
	// 	await fs.mkdir(path.join(process.cwd(), 'dist'), { recursive: true })
	// 	console.log('Building...')
	// 	await new Promise((resolve, reject) => {
	// 		exec('npm run build', (err, stdout, stderr) => {
	// 			if (err) {
	// 				reject(stderr)
	// 			} else {
	// 				resolve(stdout)
	// 			}
	// 		})
	// 	})
	// 	console.log('Compiling distributables...')
	// 	await new Promise((resolve, reject) => {
	// 		exec('npm run make', (err, stdout, stderr) => {
	// 			if (err) {
	// 				reject(stderr)
	// 			} else {
	// 				resolve(stdout)
	// 			}
	// 		})
	// 	})
	// 	console.log('Build successful')
	// 	let release = await getRelease(versionString)
	// 	if (release) {
	// 		console.log('A release with this version already exists, publishing to existing release...')
	// 	} else {
	// 		console.log('Creating release...')
	// 		await octokit.rest.repos.createRelease({
	// 			owner: 'tldraw',
	// 			repo: 'tldraw-desktop',
	// 			tag_name: versionString,
	// 			name: versionString,
	// 			body: releaseNotes,
	// 			draft: true,
	// 			prerelease: false,
	// 		})
	// 		release = await getRelease(versionString)
	// 		console.log(`Release created: ${versionString}`)
	// 	}
	// 	if (!release) {
	// 		throw Error('Failed to create release')
	// 	}
	// 	console.log('Publishing artifacts...')
	// 	await uploadFiles(versionString, release.id)
	// 	console.log(`Published!`)
	// 	// Link to the release
	// 	console.log(
	// 		`Release URL: https://github.com/tldraw/tldraw-desktop/releases/tag/${versionString}`
	// 	)
	// } catch (error) {
	// 	console.error('Error:', error)
	// 	process.exit(1)
	// }
}

main()
