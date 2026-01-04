import { AppStoreSchema } from 'src/types'
import { atom } from 'tldraw'

export const filePathAtom = atom<string | null>('file path', null)

export const unsavedChangesAtom = atom<boolean>('unsaved changes', false)

export const userPreferencesAtom = atom<AppStoreSchema['userPreferences']>('user preferences', {
	theme: 'light',
	isGridMode: false,
	isToolLocked: false,
	exportBackground: false,
	autoCheckUpdates: true,
})

/**
 * Reset all shared atoms to their default values.
 * Useful for clearing state between editor sessions or in tests.
 */
export function resetSharedAtoms() {
	filePathAtom.set(null)
	unsavedChangesAtom.set(false)
	// Note: userPreferencesAtom is intentionally NOT reset as it should persist
}

// Expose on window for test access
// Usage in tests: await page.evaluate(() => (window as any).resetSharedAtoms())
;(window as any).resetSharedAtoms = resetSharedAtoms
