import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { unzipSync, strFromU8 } from 'fflate';
import { BatchModePage } from './pages/batch-mode/BatchModePage';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Batch export to Brother P-touch (.lbx)', () => {
	test('exports the whole batch as one image-wrapped strip .lbx', async ({ page }) => {
		const form = new SingleModePage(page);
		const batchPage = new BatchModePage(page);

		await batchPage.goto();
		await batchPage.selectTapeHeight('12mm');

		// Add three labels to the batch.
		for (const primary of ['M8 x 20', 'M6 x 16', 'M4 x 10']) {
			await form.selectMode('general');
			await form.fillPrimaryText(primary);
			await batchPage.addLabel();
		}

		const lbxButton = page.getByTestId('export-lbx-button');
		await expect(lbxButton).toBeEnabled();

		const downloadPromise = page.waitForEvent('download');
		await lbxButton.click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.lbx$/);

		// One .lbx = one long sheet with a single embedded strip bitmap (not N files,
		// not text objects). See docs/plan-lbx-export.md "Batch route investigation".
		const files = unzipSync(readFileSync(await download.path()));
		expect(Object.keys(files)).toEqual(
			expect.arrayContaining(['label.xml', 'prop.xml', 'Object0.bmp'])
		);

		const labelXml = strFromU8(files['label.xml']);
		expect((labelXml.match(/<image:image>/g) || []).length).toBe(1);
		expect(labelXml).not.toContain('<text:text>');

		const bmp = files['Object0.bmp'];
		expect(bmp[0]).toBe(0x42); // 'B'
		expect(bmp[1]).toBe(0x4d); // 'M'
	});
});
