import { expect, test } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';

/**
 * Regression for #169: switching from a standard with a length (screw) to one
 * without (washer / nut) disables the length input but keeps its value. The
 * preview drops the stale length; the batch snapshot must drop it too.
 */
test.describe('Batch Mode - stale length on length-less hardware (#169)', () => {
	const cases = [
		{ name: 'washer', search: '7089', pattern: /ISO 7089.*DIN 125/ },
		{ name: 'hex nut', search: '4032', pattern: /ISO 4032.*DIN 934/ }
	];

	for (const { name, search, pattern } of cases) {
		test(`${name} label added after a screw has no length`, async ({ page }) => {
			// Given: a screw label with a length was added, then the form switched to a length-less standard
			const batchPage = new BatchModePage(page);
			await batchPage.goto();
			const form = new SingleModePage(page);
			await form.selectMode('fastener');
			await form.selectHardwareByName('4762', /ISO 4762.*DIN 912/);
			await form.selectThreadSize('M8');
			await form.fillLength('20');
			await batchPage.addLabel();
			await batchPage.waitForLabel(0);
			await expect(batchPage.getChipPrimary(0)).toHaveText('M8 × 20');

			await form.selectHardwareByName(search, pattern);
			await expect(form.lengthInput).toBeDisabled();

			// When: the current label is added to the batch
			await batchPage.addLabel();
			await batchPage.waitForLabel(1);

			// Then: the batch label shows the thread size only, like the preview
			await expect(batchPage.getChipPrimary(1)).toHaveText('M8');
		});
	}
});
