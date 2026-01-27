import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

/**
 * Regression test for bug: Label preview image doesn't appear after
 * switching from General Item mode back to Fastener mode.
 *
 * Steps to reproduce:
 * 1. Go to the page (starts in Fastener mode)
 * 2. Click "General Item"
 * 3. Click back to "Fastener"
 * 4. Select a standard from the list
 * 5. Select thread size, etc.
 * 6. BUG: Label preview image doesn't appear
 *
 * Root cause: The "Hardware Icon" toggle switch remains unchecked after
 * switching back to Fastener mode, even though it should be checked by default.
 */
test.describe('Mode Switch Image Regression', () => {
	let labelPage: SingleModePage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleModePage(page);
		await labelPage.goto();
	});

	test('label preview should render after switching from General Item back to Fastener', async () => {
		// ===== STEP 1: Verify initial Fastener mode works (baseline) =====
		await labelPage.selectMode('fastener');
		await labelPage.selectHardwareByName('4762', /ISO 4762.*DIN 912/);
		await labelPage.selectThreadSize('M8');
		await labelPage.fillLength('25');

		// Verify canvas renders correctly in initial state
		await labelPage.preview.waitForLabelRender();
		const canvas = labelPage.preview.canvas;
		await expect(canvas).toBeVisible();
		await expect(canvas).toHaveAttribute('data-render-status', 'stable');
		await expect(canvas).toHaveAttribute('data-primary-text', 'M8 × 25');
		expect(await labelPage.preview.isShowingLabel()).toBe(true);

		// ===== STEP 2: Switch to General Item mode =====
		await labelPage.selectMode('general');

		// Verify we're in General Item mode (primary text input is visible)
		await expect(labelPage.primaryTextInput).toBeVisible();

		// ===== STEP 3: Switch back to Fastener mode =====
		await labelPage.selectMode('fastener');

		// Wait for thread size button to be visible (indicates Fastener mode is active)
		await expect(labelPage.threadSizeButton).toBeVisible();

		// ===== STEP 4: Select a standard from the list =====
		await labelPage.selectHardwareByName('4014', /ISO 4014.*DIN 931/);

		// ===== STEP 5: Select thread size and length =====
		await labelPage.selectThreadSize('M10');
		await labelPage.fillLength('40');

		// ===== STEP 6: Verify label preview renders (THIS IS WHERE THE BUG MANIFESTS) =====
		await labelPage.preview.waitForLabelRender();

		// Canvas should be visible
		await expect(canvas).toBeVisible();

		// Canvas should have stable render status
		await expect(canvas).toHaveAttribute('data-render-status', 'stable');

		// Canvas should show the correct primary text
		await expect(canvas).toHaveAttribute('data-primary-text', 'M10 × 40');

		// Canvas should actually be showing a label (not empty)
		expect(await labelPage.preview.isShowingLabel()).toBe(true);

		// Hardware image switch should be checked (image should be displayed)
		await expect(labelPage.hardwareImageSwitch).toBeChecked();
	});

	test('hardware image should remain OFF for 9mm labels after mode switch', async () => {
		// This test verifies that the 9mm constraint takes precedence over mode switching

		// ===== STEP 1: Select 9mm label height =====
		await labelPage.selectLabelSize('9mm');

		// Hardware image should be disabled for 9mm
		await expect(labelPage.hardwareImageSwitch).toBeDisabled();
		await expect(labelPage.hardwareImageSwitch).not.toBeChecked();

		// ===== STEP 2: Switch to General Item mode =====
		await labelPage.selectMode('general');

		// Hardware image should still be unchecked (disabled in general mode too)
		await expect(labelPage.hardwareImageSwitch).not.toBeChecked();

		// ===== STEP 3: Switch back to Fastener mode =====
		await labelPage.selectMode('fastener');

		// ===== STEP 4: Verify hardware image is STILL disabled for 9mm =====
		// BUG: Without the fix, this would be checked (enabled) incorrectly
		await expect(labelPage.hardwareImageSwitch).toBeDisabled();
		await expect(labelPage.hardwareImageSwitch).not.toBeChecked();
	});

	test('label preview should render after multiple mode switches', async () => {
		// This test verifies the bug doesn't occur after multiple switches

		// Start in Fastener mode
		await labelPage.selectMode('fastener');

		// Switch multiple times
		await labelPage.selectMode('general');
		await labelPage.selectMode('fastener');
		await labelPage.selectMode('general');
		await labelPage.selectMode('fastener');

		// Now select hardware and fill in details
		await labelPage.selectHardwareByName('4762', /ISO 4762/);
		await labelPage.selectThreadSize('M6');
		await labelPage.fillLength('20');

		// Verify canvas renders
		await labelPage.preview.waitForLabelRender();
		const canvas = labelPage.preview.canvas;

		await expect(canvas).toBeVisible();
		await expect(canvas).toHaveAttribute('data-render-status', 'stable');
		await expect(canvas).toHaveAttribute('data-primary-text', 'M6 × 20');
		expect(await labelPage.preview.isShowingLabel()).toBe(true);

		// Hardware image switch should be checked (image should be displayed)
		await expect(labelPage.hardwareImageSwitch).toBeChecked();
	});
});
