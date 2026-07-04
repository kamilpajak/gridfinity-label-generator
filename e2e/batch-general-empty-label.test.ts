import { expect, test } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Batch Mode - General empty label guard', () => {
	test('cannot add a general label while the form has no content', async ({ page }) => {
		const batchPage = new BatchModePage(page);
		await batchPage.goto();

		const form = new SingleModePage(page);
		await form.selectMode('general');

		// General mode has no required fastener fields, so the only thing stopping a
		// blank label is the content check. With an empty form the Add button must
		// stay disabled and no row may be created.
		await expect(batchPage.addLabelButton).toBeDisabled();
		expect(await batchPage.getRowCount()).toBe(0);

		// Once the label has content, adding is enabled and appends exactly one row.
		await form.fillPrimaryText('Widget');
		await expect(batchPage.addLabelButton).toBeEnabled();

		await batchPage.addLabel();
		await batchPage.waitForLabel(0);
		expect(await batchPage.getRowCount()).toBe(1);
	});
});
