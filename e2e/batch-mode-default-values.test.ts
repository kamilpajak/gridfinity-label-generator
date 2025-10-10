import { expect, test } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Batch Mode - Default Values', () => {
	test('should have empty length field matching single mode behavior', async ({ page }) => {
		const singlePage = new SingleModePage(page);
		const batchPage = new BatchModePage(page);

		await singlePage.goto();

		const singleModeLength = page.getByTestId('length-input');
		const singleModeValue = await singleModeLength.inputValue();

		// Switch to batch mode
		await batchPage.navigation.switchToBatchMode();

		// Add first label
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Check batch mode default
		const batchModeLength = page.locator('input[id^="length-"]').first();
		const batchModeValue = await batchModeLength.inputValue();

		// Both should be empty strings
		expect(singleModeValue).toBe('');
		expect(batchModeValue).toBe('');
		expect(batchModeValue).toBe(singleModeValue);
	});
});
