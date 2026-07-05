import { expect, test } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Export to Brother P-touch (.lbx)', () => {
	test('downloads a .lbx file for a completed fastener label', async ({ page }) => {
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
	});
});
