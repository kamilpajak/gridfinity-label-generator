import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { unzipSync, strFromU8 } from 'fflate';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Export to Brother P-touch (.lbx)', () => {
	test('downloads an image-wrapped .lbx for a completed fastener label', async ({ page }) => {
		const form = new SingleModePage(page);
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		await form.selectMode('fastener');
		await form.selectHardwareByName('ISO', /ISO 4762/);
		await form.selectThreadSize('M8');
		await form.fillLength('20');

		const lbxButton = page.getByTestId('export-lbx-button');
		await expect(lbxButton).toBeEnabled();

		const downloadPromise = page.waitForEvent('download');
		await lbxButton.click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toMatch(/\.lbx$/);

		// The .lbx must be a ZIP that embeds the rendered label as a BMP image
		// object — not a P-touch text object (which would lose the font and the ×).
		const path = await download.path();
		const files = unzipSync(readFileSync(path));
		const names = Object.keys(files);
		expect(names).toContain('label.xml');
		expect(names).toContain('Object0.bmp');

		const labelXml = strFromU8(files['label.xml']);
		expect(labelXml).toContain('<image:image>');
		expect(labelXml).toContain('fileName="Object0.bmp"');
		expect(labelXml).not.toContain('<text:text>');

		// The embedded file is a real BMP (starts with the 'BM' magic).
		const bmp = files['Object0.bmp'];
		expect(bmp[0]).toBe(0x42);
		expect(bmp[1]).toBe(0x4d);
	});
});
