import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';
import { UI_TEXT } from '../src/lib/constants/ui-text';

test.describe('Hardware Type Transitions - Length Field Behavior', () => {
	let labelPage: SingleModePage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleModePage(page);
		await labelPage.goto();
		// Select fastener mode
		await labelPage.selectMode('fastener');
	});

	test('should handle switching from screw (with length) to nut (without length)', async () => {
		// ===== STEP 1: Select DIN 912 (ISO 4762) - Socket Head Cap Screw =====
		await labelPage.selectHardwareByName('4762', /ISO 4762.*DIN 912/);

		// Verify length field is enabled for screw
		await expect(labelPage.lengthInput).toBeEnabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthMetric
		);

		// ===== STEP 2: Enter thread size and length =====
		await labelPage.selectThreadSize('M8');
		await labelPage.fillLength('25');

		// Verify the values are entered
		await expect(labelPage.threadSizeButton).toContainText('M8');
		await expect(labelPage.lengthInput).toHaveValue('25');

		// ===== STEP 3: Check label preview shows M8x25 =====
		// Wait for canvas to render
		await labelPage.preview.waitForLabelRender();
		const canvas = labelPage.preview.canvas;
		await expect(canvas).toBeVisible();
		// Verify the preview shows M8x25 (with length)
		await expect(canvas).toHaveAttribute('data-primary-text', 'M8 × 25');

		// ===== STEP 4: Switch to DIN 934 (ISO 4032) - Hex Nut =====
		await labelPage.selectHardwareByName('4032', /ISO 4032.*DIN 934/);

		// ===== STEP 5: Verify length field is now disabled =====
		await expect(labelPage.lengthInput).toBeDisabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthNA
		);

		// ===== STEP 6: Verify thread size is still M8 =====
		await expect(labelPage.threadSizeButton).toContainText('M8');

		// ===== STEP 7: Verify length value is preserved but field is disabled =====
		await expect(labelPage.lengthInput).toHaveValue('25');
		await expect(labelPage.lengthInput).toBeDisabled();

		// ===== STEP 8: Check label preview shows only M8 (no length) =====
		await expect(canvas).toBeVisible();
		// Wait for preview to update
		await labelPage.preview.waitForLabelRender();
		// Verify the preview shows only M8 (WITHOUT length)
		await expect(canvas).toHaveAttribute('data-primary-text', 'M8');

		// ===== STEP 9: Switch back to screw and verify length is re-enabled =====
		await labelPage.selectHardwareByName('4762', /ISO 4762.*DIN 912/);

		// Length field should be enabled again
		await expect(labelPage.lengthInput).toBeEnabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthMetric
		);
		// Value should still be preserved
		await expect(labelPage.lengthInput).toHaveValue('25');

		// ===== STEP 10: Change to imperial and verify placeholder updates =====
		await labelPage.selectUnits('imperial');
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthImperial
		);
		// Field should still be enabled for screw
		await expect(labelPage.lengthInput).toBeEnabled();

		// Switch to nut in imperial mode
		await labelPage.selectHardwareByName('4032', /ISO 4032.*DIN 934/);

		// Should still show N/A for nuts regardless of unit system
		await expect(labelPage.lengthInput).toBeDisabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthNA
		);
	});

	test('should NOT show length in preview for washer even when length value exists', async () => {
		// Select a screw and enter thread size and length
		await labelPage.selectHardwareByName('4762', /ISO 4762/);
		await labelPage.selectThreadSize('M10');
		await labelPage.fillLength('30');
		await expect(labelPage.lengthInput).toHaveValue('30');

		// Wait for preview and verify it shows M10x30
		await labelPage.preview.waitForLabelRender();
		const canvas = labelPage.preview.canvas;
		await expect(canvas).toHaveAttribute('data-primary-text', 'M10 × 30');

		// Switch to washer (ISO 7089 / DIN 125)
		await labelPage.selectHardwareByName('7089', /ISO 7089.*DIN 125/);

		// Length should be disabled but value preserved in input
		await expect(labelPage.lengthInput).toBeDisabled();
		await expect(labelPage.lengthInput).toHaveValue('30');

		// CRITICAL: Preview should NOT show length for washer
		await labelPage.preview.waitForLabelRender();
		await expect(canvas).toHaveAttribute('data-primary-text', 'M10');

		// Switch back to screw
		await labelPage.selectHardwareByName('4762', /ISO 4762/);

		// Field should be enabled and value still preserved
		await expect(labelPage.lengthInput).toBeEnabled();
		await expect(labelPage.lengthInput).toHaveValue('30');

		// Preview should show length again
		await labelPage.preview.waitForLabelRender();
		await expect(canvas).toHaveAttribute('data-primary-text', 'M10 × 30');

		// Now we can clear it
		await labelPage.fillLength('');
		await expect(labelPage.lengthInput).toHaveValue('');
		await labelPage.preview.waitForLabelRender();
		await expect(canvas).toHaveAttribute('data-primary-text', 'M10');
	});

	test('should handle rapid switching between different hardware types', async () => {
		// Select M6 thread size
		await labelPage.selectThreadSize('M6');

		// First select a screw to ensure length field is enabled
		await labelPage.selectHardwareByName('4762', /ISO 4762/);

		const hardwareTypes = [
			{ search: '4762', name: /ISO 4762/, type: 'screw', lengthEnabled: true }, // Socket head cap screw
			{ search: '4032', name: /ISO 4032/, type: 'nut', lengthEnabled: false }, // Hex nut
			{ search: '7089', name: /ISO 7089/, type: 'washer', lengthEnabled: false }, // Flat washer
			{ search: '4014', name: /ISO 4014/, type: 'bolt', lengthEnabled: true }, // Hex head bolt
			{ search: '4032', name: /ISO 4032/, type: 'nut', lengthEnabled: false }, // Back to nut
			{ search: '4762', name: /ISO 4762/, type: 'screw', lengthEnabled: true } // Back to screw
		];

		// Enter initial length value
		await labelPage.fillLength('20');

		for (const hardware of hardwareTypes) {
			// Select hardware
			await labelPage.selectHardwareByName(hardware.search, hardware.name);

			// Verify length field state
			if (hardware.lengthEnabled) {
				await expect(labelPage.lengthInput).toBeEnabled();
				await expect(labelPage.lengthInput).not.toHaveAttribute(
					'placeholder',
					'N/A for this hardware type'
				);
			} else {
				await expect(labelPage.lengthInput).toBeDisabled();
				await expect(labelPage.lengthInput).toHaveAttribute(
					'placeholder',
					'N/A for this hardware type'
				);
			}

			// Thread size should always remain selected
			await expect(labelPage.threadSizeButton).toContainText('M6');

			// Length value should be preserved
			await expect(labelPage.lengthInput).toHaveValue('20');

			// Verify preview shows correct text based on hardware type
			await labelPage.preview.waitForLabelRender();
			const canvas = labelPage.preview.canvas;
			if (hardware.lengthEnabled) {
				// Should show M6x20 for screws and bolts
				await expect(canvas).toHaveAttribute('data-primary-text', 'M6 × 20');
			} else {
				// Should show only M6 for nuts and washers (no length)
				await expect(canvas).toHaveAttribute('data-primary-text', 'M6');
			}
		}
	});
});
