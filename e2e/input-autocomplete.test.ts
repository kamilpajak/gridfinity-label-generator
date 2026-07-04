import { expect, test } from '@playwright/test';

// The label-data inputs must not trigger the browser's form-history autocomplete
// dropdown (a list of previously typed values) or the white autofill background.
// autocomplete="off" suppresses both.
test.describe('Form inputs disable browser autocomplete', () => {
	test('length and note inputs render autocomplete="off"', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		await expect(page.getByTestId('length-input')).toHaveAttribute('autocomplete', 'off');
		await expect(page.getByTestId('optional-note-input')).toHaveAttribute('autocomplete', 'off');
	});
});
