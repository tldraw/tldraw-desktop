import { userPreferencesAtom } from '@renderer/components/sharedAtoms'
import { useEffect } from 'react'
import { Editor, react, useValue } from 'tldraw'

/**
 * Hook that syncs dark mode between the app preferences and the tldraw editor.
 *
 * This replaces the SneakyDarkModeSync component with proper hook-based lifecycle management.
 * Handles bidirectional sync:
 * 1. App preferences -> Editor (when user changes system theme)
 * 2. Editor -> App preferences (when user changes theme via editor UI)
 */
export function useEditorDarkModeSync(editor: Editor | null): void {
	// Watch app dark mode preference
	const appIsDark = useValue('app dark mode', () => userPreferencesAtom.get().theme === 'dark', [])

	// Sync app preferences -> editor
	useEffect(() => {
		if (!editor) return

		const editorIsDark = editor.user.getIsDarkMode()
		if (editorIsDark === appIsDark) {
			return
		}

		editor.user.updateUserPreferences({ colorScheme: appIsDark ? 'dark' : 'light' })
	}, [editor, appIsDark])

	// Sync editor -> app preferences (via IPC to main process)
	useEffect(() => {
		if (!editor) return

		const cleanup = react('editor dark mode changes', () => {
			const editorIsDark = editor.user.getIsDarkMode()
			const appIsDark = userPreferencesAtom.__unsafe__getWithoutCapture().theme === 'dark'

			if (editorIsDark === appIsDark) {
				return
			}

			window.api.sendRendererEventToMain('editor-user-preferences-change', {
				theme: editorIsDark ? 'dark' : 'light',
			})
		})

		return cleanup
	}, [editor])
}
