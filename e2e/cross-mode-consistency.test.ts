import { expect, test } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';
import { BatchModePage } from './pages/batch-mode/BatchModePage';

/**
 * Cross-Mode Consistency Tests
 *
 * These tests ensure that Single Mode and Batch Mode behave consistently.
 * Users expect the same rules and patterns regardless of which mode they use.
 *
 * Consistency tested:
 * 1. Switch disabled/enabled logic should match between modes
 * 2. Default values should match between modes
 * 3. Field validation should match between modes
 */

test.describe('Cross-Mode Consistency', () => {
	test('switch disabled logic should match: Fastener 12mm no standard', async ({ page }) => {
		// SCENARIO: Fastener mode, 12mm label, NO standard selected
		// EXPECTED: Both modes should have same disabled state for switches

		const singlePage = new SingleModePage(page);
		await singlePage.goto();
		await singlePage.selectMode('fastener');
		await singlePage.selectLabelSize('12mm');

		// Get single mode switch states
		const singleHardwareImageDisabled = await singlePage.hardwareImageSwitch.isDisabled();
		const singleStandardRefDisabled = await singlePage.standardReferenceSwitch.isDisabled();
		const singleQrDisabled = await singlePage.qrCodeSwitch.isDisabled();

		// Switch to batch mode
		const batchPage = new BatchModePage(page);
		await batchPage.navigation.switchToBatchMode();
		await batchPage.selectTapeHeight('12mm');

		// Add a label (defaults to fastener mode, no standard)
		await batchPage.addLabel();
		await page.waitForTimeout(100); // Let UI stabilize

		// Get batch mode switch states (label index 0)
		const batchHardwareImageSwitch = page.getByTestId('hardware-image-switch-0');
		const batchQrSwitch = page.getByTestId('qr-code-switch-0');

		const batchHardwareImageDisabled = await batchHardwareImageSwitch.isDisabled();
		const batchQrDisabled = await batchQrSwitch.isDisabled();

		// Find showReference switch in batch mode (doesn't have unique testid with index)
		const batchRow = page.getByTestId('batch-label-row-0');
		const allSwitches = await batchRow.locator('button[role="switch"]').all();

		// showReference is typically the first switch in fastener mode
		let batchStandardRefDisabled = false;
		if (allSwitches.length >= 3) {
			// First switch should be showReference
			batchStandardRefDisabled = await allSwitches[0].isDisabled();
		}

		// CONSISTENCY CHECK: disabled states must match
		expect(singleHardwareImageDisabled, 'Hardware Image disabled state should match').toBe(
			batchHardwareImageDisabled
		);

		expect(singleStandardRefDisabled, 'Standard Reference disabled state should match').toBe(
			batchStandardRefDisabled
		);

		expect(singleQrDisabled, 'QR Code disabled state should match').toBe(batchQrDisabled);

		// DOCUMENTATION: If this test fails, it means:
		// Single mode and batch mode have different logic for disabling switches.
		// This confuses users who expect consistent behavior.
		//
		// Common causes:
		// 1. Single mode: disabled={!standardId}
		//    Batch mode: disabled={true} (hardcoded)
		//
		// 2. Single mode: disabled={labelMode === 'general'}
		//    Batch mode: disabled={isFastenerMode ? false : true} (different logic)
		//
		// FIX: Make sure both use the SAME disabling logic based on:
		// - Mode (fastener vs general)
		// - Height (9mm vs 12mm)
		// - NOT based on whether standard is selected (that was the bug!)
	});

	test('switch disabled logic should match: General Item 12mm', async ({ page }) => {
		// SCENARIO: General Item mode, 12mm label
		// EXPECTED: Hardware switches should be disabled in BOTH modes

		const singlePage = new SingleModePage(page);
		await singlePage.goto();
		await singlePage.selectMode('general');
		await singlePage.selectLabelSize('12mm');

		// Get single mode states
		const singleHardwareImageDisabled = await singlePage.hardwareImageSwitch.isDisabled();
		const singleStandardRefDisabled = await singlePage.standardReferenceSwitch.isDisabled();
		const singleQrDisabled = await singlePage.qrCodeSwitch.isDisabled();

		// Switch to batch mode
		const batchPage = new BatchModePage(page);
		await batchPage.navigation.switchToBatchMode();
		await batchPage.selectTapeHeight('12mm');
		await batchPage.addLabel();

		// Change to general mode in batch
		const modeToggle = page
			.getByTestId('batch-label-row-0')
			.locator('[data-testid^="label-mode-toggle"]')
			.first();
		const generalButton = modeToggle.getByRole('radio', { name: 'General Item' });
		await generalButton.click();
		await page.waitForTimeout(100);

		// Get batch mode states
		// In general mode, hardware switches don't exist in batch mode
		// So we check if they're not visible or if visible, they're disabled
		const batchQrSwitch = page.getByTestId('qr-code-switch-0');
		const batchQrDisabled = await batchQrSwitch.isDisabled();

		// CONSISTENCY CHECK
		expect(singleQrDisabled, 'QR Code disabled state should match in general mode').toBe(
			batchQrDisabled
		);

		// Both should have hardware switches disabled in general mode
		expect(singleHardwareImageDisabled).toBe(true);
		expect(singleStandardRefDisabled).toBe(true);
	});

	test('switch disabled logic should match: 9mm label height', async ({ page }) => {
		// SCENARIO: 9mm label (both modes)
		// EXPECTED: QR and Hardware Image should be disabled in BOTH modes

		const singlePage = new SingleModePage(page);
		await singlePage.goto();
		await singlePage.selectMode('fastener');
		await singlePage.selectLabelSize('9mm');

		// Get single mode states for 9mm
		const singleHardwareImageDisabled = await singlePage.hardwareImageSwitch.isDisabled();
		const singleQrDisabled = await singlePage.qrCodeSwitch.isDisabled();

		// Switch to batch mode
		const batchPage = new BatchModePage(page);
		await batchPage.navigation.switchToBatchMode();
		await batchPage.selectTapeHeight('9mm');
		await batchPage.addLabel();
		await page.waitForTimeout(100);

		// Get batch mode states for 9mm
		const batchHardwareImageSwitch = page.getByTestId('hardware-image-switch-0');
		const batchQrSwitch = page.getByTestId('qr-code-switch-0');

		const batchHardwareImageDisabled = await batchHardwareImageSwitch.isDisabled();
		const batchQrDisabled = await batchQrSwitch.isDisabled();

		// CONSISTENCY CHECK
		expect(singleHardwareImageDisabled, 'Hardware Image should be disabled for 9mm').toBe(true);
		expect(batchHardwareImageDisabled, 'Hardware Image should be disabled for 9mm in batch').toBe(
			true
		);

		expect(singleQrDisabled, 'QR Code should be disabled for 9mm').toBe(true);
		expect(batchQrDisabled, 'QR Code should be disabled for 9mm in batch').toBe(true);

		// Both modes should match
		expect(singleHardwareImageDisabled).toBe(batchHardwareImageDisabled);
		expect(singleQrDisabled).toBe(batchQrDisabled);
	});

	test('default switch values should match between modes', async ({ page }) => {
		// SCENARIO: Fresh label in both modes
		// EXPECTED: Default checked state should match

		const singlePage = new SingleModePage(page);
		await singlePage.goto();
		await singlePage.selectMode('fastener');

		// Get single mode defaults
		const singleHardwareImageChecked = await singlePage.hardwareImageSwitch.isChecked();
		const singleStandardRefChecked = await singlePage.standardReferenceSwitch.isChecked();
		const singleQrChecked = await singlePage.qrCodeSwitch.isChecked();

		// Switch to batch mode
		const batchPage = new BatchModePage(page);
		await batchPage.navigation.switchToBatchMode();
		await batchPage.addLabel();
		await page.waitForTimeout(100);

		// Get batch mode defaults
		const batchRow = page.getByTestId('batch-label-row-0');
		const allSwitches = await batchRow.locator('button[role="switch"]').all();

		// Assuming order: showReference, showImage, showQRCode
		const batchStandardRefChecked =
			allSwitches.length >= 1
				? (await allSwitches[0].getAttribute('data-state')) === 'checked'
				: false;
		const batchHardwareImageChecked =
			allSwitches.length >= 2
				? (await allSwitches[1].getAttribute('data-state')) === 'checked'
				: false;
		const batchQrChecked =
			allSwitches.length >= 3
				? (await allSwitches[2].getAttribute('data-state')) === 'checked'
				: false;

		// CONSISTENCY CHECK: defaults should match
		expect(singleHardwareImageChecked, 'Hardware Image default should match').toBe(
			batchHardwareImageChecked
		);

		expect(singleStandardRefChecked, 'Standard Reference default should match').toBe(
			batchStandardRefChecked
		);

		expect(singleQrChecked, 'QR Code default should match').toBe(batchQrChecked);

		// DOCUMENTATION: If this fails, users will see different defaults in different modes
		// This is confusing. Defaults should be consistent.
	});
});
