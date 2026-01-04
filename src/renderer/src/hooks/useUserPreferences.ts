import { userPreferencesAtom } from '@renderer/components/sharedAtoms'
import { useLayoutEffect } from 'react'
import { useValue } from 'tldraw'

export function useUserPreferences() {
	const userPreferences = useValue('user-preferences', () => userPreferencesAtom.get(), [])

	useLayoutEffect(() => {
		const unsubs = [
			window.api.onMainEvent('home-info-ready', ({ userPreferences }) => {
				userPreferencesAtom.set(userPreferences)
			}),
			window.api.onMainEvent('editor-info-ready', ({ userPreferences }) => {
				userPreferencesAtom.set(userPreferences)
			}),
			window.api.onMainEvent('user-preferences-change', (info) => {
				userPreferencesAtom.set(info.userPreferences)
			}),
		]

		return () => {
			unsubs.forEach((unsub) => unsub())
		}
	}, [])

	return userPreferences
}
