/**
 * Batch Mode 35mm Label Mutual Exclusion Test
 *
 * Tests the specific bug where Hardware Icon and QR Code switches
 * are both enabled when adding a new label with default 35mm width
 * and selecting a standard.
 *
 * Expected behavior:
 * - Default width is 35mm (< 50mm threshold)
 * - When standard is selected, only ONE of Hardware Icon or QR Code should be enabled
 * - Both switches should NOT be enabled simultaneously on labels < 50mm
 */

import { test, expect } from '@playwright/test';
import { BatchModePage } from './pages/batch-mode/BatchModePage';

test.describe('Batch Mode - 35mm Label Mutual Exclusion Bug', () => {
	let batchPage: BatchModePage;

	test.beforeEach(async ({ page }) => {
		batchPage = new BatchModePage(page);
		await batchPage.goto();
		// Select 12mm tape (QR enabled)
		await batchPage.selectTapeHeight('12mm');
	});

	test('should NOT have both Hardware Icon and QR Code enabled on newly added 35mm label', async ({
		page
	}) => {
		// Add a new label (default width is 35mm)
		await batchPage.addLabel();
		await batchPage.waitForLabel(0);

		// Get the switches for the first label
		const hardwareSwitch = page.getByTestId('hardware-image-switch-0');
		const qrSwitch = page.getByTestId('qr-code-switch-0');

		// Wait for switches to be ready
		await expect(hardwareSwitch).toBeVisible();
		await expect(qrSwitch).toBeVisible();

		// Check if switches are disabled (e.g., no standard selected for hardware)
		const hardwareDisabled = await hardwareSwitch.isDisabled();
		const qrDisabled = await qrSwitch.isDisabled();

		// Check if switches are checked
		const hardwareChecked = await hardwareSwitch.isChecked();
		const qrChecked = await qrSwitch.isChecked();

		// BUG: Both switches are enabled (checked=true) by default
		// Expected: Since width is 35mm (< 50mm), both should NOT be enabled simultaneously
		// Even if no standard is selected, the switches should respect mutual exclusion

		// If both switches are not disabled (i.e., they CAN be toggled),
		// then they should NOT both be checked at width < 50mm
		if (!hardwareDisabled && !qrDisabled) {
			// This assertion will FAIL, showing the bug
			const bothEnabled = hardwareChecked && qrChecked;
			expect(bothEnabled).toBe(false); // At least one should be disabled
		}

		// Alternative assertion: At width 35mm, we expect mutual exclusion regardless of disabled state
		// This should also fail
		const bothChecked = hardwareChecked && qrChecked;
		expect(bothChecked).toBe(false);
	});
});
