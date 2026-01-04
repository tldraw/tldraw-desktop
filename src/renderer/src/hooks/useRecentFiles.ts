import { useLayoutEffect, useState } from 'react'
import { RecentFileData } from 'src/types'

export function useRecentFiles() {
	const [recentFiles, setRecentFiles] = useState<RecentFileData[]>([])
	useLayoutEffect(() => {
		const unsubs = [
			window.api.onMainEvent('home-info-ready', ({ recentFiles }) => {
				setRecentFiles(recentFiles)
			}),
			window.api.onMainEvent('recent-files-change', ({ recentFiles }) => {
				setRecentFiles(recentFiles)
			}),
		]

		return () => {
			unsubs.forEach((unsub) => unsub())
		}
	}, [])
	return recentFiles
}
