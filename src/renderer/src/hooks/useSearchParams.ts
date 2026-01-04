import { userPreferencesAtom } from '@renderer/components/sharedAtoms'
import { useLayoutEffect } from 'react'
import { useSearchParams } from 'react-router'

export function useSearchParamSettings() {
	const [searchParams] = useSearchParams({ theme: 'light' })
	useLayoutEffect(() => {
		if (searchParams.get('theme') === 'dark') {
			userPreferencesAtom.update((v) => ({ ...v, theme: 'dark' }))
		} else {
			userPreferencesAtom.update((v) => ({ ...v, theme: 'light' }))
		}
	}, [searchParams])
}
