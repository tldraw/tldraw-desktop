import { AboutPOM } from 'e2e/poms/about-pom'
import { EditorPOM } from 'e2e/poms/editor-pom'
import { setupTestFile } from 'e2e/setup-test'

const { test, expect } = setupTestFile()

test.describe('About Page', () => {
	test('opens from home window and closes without affecting it', async ({ app, homePom }) => {
		const aboutPom = await AboutPOM.After(app, () => homePom.appMenu.help.about())
		await expect(aboutPom.page).toHaveURL(/#\/about/)
		await aboutPom.expectLayoutVisible()

		await aboutPom.close()
		expect(aboutPom.page.isClosed()).toBe(true)
		expect(homePom.page.isClosed()).toBe(false)
	})

	test('opens from editor window and closes without affecting it', async ({ app, homePom }) => {
		const editor = await EditorPOM.After(app, () => homePom.newFile())
		const aboutPom = await AboutPOM.After(app, () => editor.appMenu.help.about())
		await expect(aboutPom.page).toHaveURL(/#\/about/)
		await aboutPom.expectLayoutVisible()

		await aboutPom.close()
		expect(aboutPom.page.isClosed()).toBe(true)
		expect(editor.page.isClosed()).toBe(false)
	})

	test('can be reopened after closing', async ({ app, homePom }) => {
		const aboutPom1 = await AboutPOM.After(app, () => homePom.appMenu.help.about())
		await aboutPom1.close()

		const aboutPom2 = await AboutPOM.After(app, () => homePom.appMenu.help.about())
		await expect(aboutPom2.page).toHaveURL(/#\/about/)
		await aboutPom2.expectLogoVisible()
	})
})
