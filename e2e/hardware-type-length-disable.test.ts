import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';
import { UI_TEXT } from '../src/lib/constants/ui-text';

test.describe('Hardware Type Length Field Behavior', () => {
	let labelPage: SingleModePage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleModePage(page);
		await labelPage.goto();
		// Select fastener mode
		await labelPage.selectMode('fastener');
	});

	test('should disable length field for nuts', async () => {
		// Select a nut standard (ISO 4032 / DIN 934 is a hex nut)
		await labelPage.selectHardwareByName('4032', /ISO 4032.*DIN 934/);

		// Check that length field is disabled
		await expect(labelPage.lengthInput).toBeDisabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthNA
		);
	});

	test('should disable length field for washers', async () => {
		// Select a washer standard (ISO 7089 / DIN 125 is a flat washer)
		await labelPage.selectHardwareByName('7089', /ISO 7089.*DIN 125/);

		// Check that length field is disabled
		await expect(labelPage.lengthInput).toBeDisabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthNA
		);
	});

	test('should enable length field for screws', async () => {
		// Select a screw standard (ISO 4762 / DIN 912 is a socket head cap screw)
		await labelPage.selectHardwareByName('4762', /ISO 4762/);

		// Check that length field is enabled
		await expect(labelPage.lengthInput).toBeEnabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthMetric
		);
	});

	test('should enable length field for bolts', async () => {
		// Select a bolt standard (ISO 4014 / DIN 931 is a hex head bolt)
		await labelPage.selectHardwareByName('4014', /ISO 4014.*DIN 931/);

		// Check that length field is enabled
		await expect(labelPage.lengthInput).toBeEnabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthMetric
		);
	});

	test('should update placeholder when switching between nut and screw', async () => {
		// First select a nut
		await labelPage.selectHardwareByName('4032', /ISO 4032.*DIN 934/);

		await expect(labelPage.lengthInput).toBeDisabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			'N/A for this hardware type'
		);

		// Then switch to a screw
		await labelPage.selectHardwareByName('4762', /ISO 4762.*DIN 912/);

		// Check that length field is now enabled
		await expect(labelPage.lengthInput).toBeEnabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthMetric
		);
	});

	test('should update placeholder for imperial measurements', async () => {
		// Select imperial
		await labelPage.selectUnits('imperial');

		// Select a screw standard
		await labelPage.selectHardwareByName('4762', /ISO 4762/);

		// Check that length field shows imperial placeholder
		await expect(labelPage.lengthInput).toBeEnabled();
		await expect(labelPage.lengthInput).toHaveAttribute(
			'placeholder',
			UI_TEXT.placeholders.lengthImperial
		);
	});
});
