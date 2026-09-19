import { expect, test } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';

/**
 * Regression for #169: switching from a standard with a length (screw) to one
 * without (washer / nut) disables the length input but keeps its value. The
 * preview drops the stale length; the batch snapshot must drop it too.
 * Same bug class applies to a stale pitch surviving a switch to a
 * washer/self-tapping standard.
 */
test.describe('Batch Mode - stale length and pitch on length-less hardware (#169)', () => {
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

			await form.selectHardwareByName(search, pattern);
			await expect(form.lengthInput).toBeDisabled();

			// When: the current label is added to the batch
			await batchPage.addLabel();
			await batchPage.waitForLabel(1);

			// Then: the first label is unchanged and the second shows the thread size only, like the preview
			await expect(batchPage.getChipPrimary(0)).toHaveText('M8 × 20');
			await expect(batchPage.getChipPrimary(1)).toHaveText('M8');
		});
	}

	test('washer label added after a fine-pitch screw has no pitch', async ({ page }) => {
		// Given: the form holds a DIN 912 M8 screw with a fine pitch and length 20
		const batchPage = new BatchModePage(page);
		await batchPage.goto();
		const form = new SingleModePage(page);
		await form.selectMode('fastener');
		await form.selectHardwareByName('4762', /ISO 4762.*DIN 912/);
		await form.selectThreadSize('M8');
		await form.selectPitch('1.0');
		await form.fillLength('20');

		// And: the fine pitch was really selected
		await form.preview.waitForLabelRender();
		await expect(form.preview.canvas).toHaveAttribute('data-primary-text', 'M8 × 1.0 × 20');

		// When: the form switches to a washer standard, which has no thread pitch
		await form.selectHardwareByName('7089', /ISO 7089.*DIN 125/);
		await expect(form.pitchSelect).toBeDisabled();

		// Then: the draft preview drops the stale pitch
		await form.preview.waitForLabelRender();
		await expect(form.preview.canvas).toHaveAttribute('data-primary-text', 'M8');

		// And: the added batch chip drops it too
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);
		await expect(batchPage.getChipPrimary(0)).toHaveText('M8');
	});
});
