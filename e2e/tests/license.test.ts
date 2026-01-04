import { EditorPOM } from 'e2e/poms/editor-pom'
import { LicensePOM } from 'e2e/poms/license-pom'
import { setupTestFile } from 'e2e/setup-test'

const { test, expect } = setupTestFile()

test.describe('License Page', () => {
	test.describe('Navigation', () => {
		test('opens from Help menu on home window', async ({ app, homePom }) => {
			const licensePom = await LicensePOM.After(app, () => homePom.appMenu.help.license())
			await expect(licensePom.page).toHaveURL(/#\/license/)
			await licensePom.expectContentVisible()
		})

		test('opens from Help menu on editor window', async ({ app, homePom }) => {
			const editor = await EditorPOM.After(app, () => homePom.newFile())
			const licensePom = await LicensePOM.After(app, () => editor.appMenu.help.license())
			await expect(licensePom.page).toHaveURL(/#\/license/)
			await licensePom.expectContentVisible()
		})

		test('closes without affecting parent window', async ({ app, homePom }) => {
			const licensePom = await LicensePOM.After(app, () => homePom.appMenu.help.license())
			await licensePom.close()
			expect(licensePom.page.isClosed()).toBe(true)
			expect(homePom.page.isClosed()).toBe(false)
		})

		test('can be reopened after closing', async ({ app, homePom }) => {
			const licensePom1 = await LicensePOM.After(app, () => homePom.appMenu.help.license())
			await licensePom1.close()

			const licensePom2 = await LicensePOM.After(app, () => homePom.appMenu.help.license())
			await expect(licensePom2.page).toHaveURL(/#\/license/)
			await licensePom2.expectContentVisible()
		})
	})
})
