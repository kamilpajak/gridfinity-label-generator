import { expect, test } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Batch Mode - Default Values', () => {
	test('shared length field is empty by default and adding a label appends one row', async ({
		page
	}) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		// The shared form's length input is empty by default (matches single mode)
		const form = new SingleModePage(page);
		expect(await form.getLengthValue()).toBe('');

		// Configure a general label and snapshot it
		await form.selectMode('general');
		await form.fillPrimaryText('Widget');

		expect(await batchPage.getRowCount()).toBe(0);

		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Adding appends exactly one read-only row reflecting the configured text
		expect(await batchPage.getRowCount()).toBe(1);
		expect(await batchPage.getChipPrimaryText(0)).toContain('Widget');
	});
});
