import { useUserPreferences } from '@renderer/hooks/useUserPreferences'

export function ThemeContainer({ children }: { children: React.ReactNode }) {
	const theme = useUserPreferences().theme

	return (
		<div
			data-testid="app-container"
			className={`tla tl-container ${theme === 'light' ? 'tla-theme__light tl-theme__light' : 'tla-theme__dark tl-theme__dark'}`}
		>
			{children}
		</div>
	)
}
