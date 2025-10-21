import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Hardware Type Pitch Field Behavior', () => {
	let labelPage: SingleModePage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleModePage(page);
		await labelPage.goto();
		// Select fastener mode
		await labelPage.selectMode('fastener');
	});

	test('should disable pitch field for washers', async () => {
		// Select a washer standard (DIN 127 is a spring lock washer)
		await labelPage.selectHardwareByName('127', /DIN 127/);

		// Check that pitch field is disabled
		await expect(labelPage.pitchSelect).toBeDisabled();
	});

	test('should disable pitch field for wood screws', async () => {
		// Select a wood screw standard (DIN 95 is a slotted countersunk wood screw)
		await labelPage.selectHardwareByName('95', /DIN 95/);

		// Check that pitch field is disabled (wood screws have self-tapping threads, not metric pitch)
		await expect(labelPage.pitchSelect).toBeDisabled();
	});

	test('should enable pitch field for metric screws', async () => {
		// Select a metric screw standard (ISO 4762 / DIN 912 is a socket head cap screw)
		await labelPage.selectHardwareByName('4762', /ISO 4762/);

		// Check that pitch field is enabled
		await expect(labelPage.pitchSelect).toBeEnabled();
	});

	test('should enable pitch field for bolts', async () => {
		// Select a bolt standard (ISO 4014 / DIN 931 is a hex head bolt)
		await labelPage.selectHardwareByName('4014', /ISO 4014.*DIN 931/);

		// Check that pitch field is enabled
		await expect(labelPage.pitchSelect).toBeEnabled();
	});

	test('should update pitch disabled state when switching between washer and screw', async () => {
		// First select a washer
		await labelPage.selectHardwareByName('127', /DIN 127/);
		await expect(labelPage.pitchSelect).toBeDisabled();

		// Then switch to a metric screw
		await labelPage.selectHardwareByName('4762', /ISO 4762.*DIN 912/);

		// Check that pitch field is now enabled
		await expect(labelPage.pitchSelect).toBeEnabled();
	});

	test('should update pitch disabled state when switching between wood screw and metric screw', async () => {
		// First select a wood screw
		await labelPage.selectHardwareByName('95', /DIN 95/);
		await expect(labelPage.pitchSelect).toBeDisabled();

		// Then switch to a metric screw
		await labelPage.selectHardwareByName('4762', /ISO 4762.*DIN 912/);

		// Check that pitch field is now enabled
		await expect(labelPage.pitchSelect).toBeEnabled();
	});
});
