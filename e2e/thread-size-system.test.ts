import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Thread Size System - Standard-specific thread sizes', () => {
	let labelPage: SingleModePage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleModePage(page);
		await labelPage.goto();
		await labelPage.selectMode('fastener');
	});

	test('DIN 571 (wood screw) should show metric decimal sizes: 3, 3.5, 4...', async () => {
		await labelPage.selectHardwareByName('571', /DIN 571/);
		await labelPage.openThreadSizeDropdown();

		// Verify expected wood screw sizes are present (plain decimal numbers)
		await expect(labelPage.getThreadSizeOption('3')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('3.5')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('4')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('4.5')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('5')).toBeVisible();

		// Verify M-series sizes are NOT present
		expect(await labelPage.hasThreadSize('M3')).toBe(false);
		expect(await labelPage.hasThreadSize('M4')).toBe(false);

		// Verify ST-series sizes are NOT present
		expect(await labelPage.hasThreadSize('ST3.5')).toBe(false);
	});

	test('ISO 7049 (sheet metal screw) should show ST sizes: ST2.2, ST3.5...', async () => {
		await labelPage.selectHardwareByName('7049', /ISO 7049/);
		await labelPage.openThreadSizeDropdown();

		// Verify expected ST sizes are present
		await expect(labelPage.getThreadSizeOption('ST2.2')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('ST2.9')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('ST3.5')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('ST4.2')).toBeVisible();

		// Verify M-series sizes are NOT present
		expect(await labelPage.hasThreadSize('M3')).toBe(false);
		expect(await labelPage.hasThreadSize('M4')).toBe(false);

		// Verify plain decimal sizes without ST prefix are NOT present
		expect(await labelPage.hasThreadSize('3')).toBe(false);
		expect(await labelPage.hasThreadSize('3.5')).toBe(false);
	});

	test('ISO 4762 (socket cap screw) should show M sizes: M3, M4, M5...', async () => {
		await labelPage.selectHardwareByName('4762', /ISO 4762/);
		await labelPage.openThreadSizeDropdown();

		// Verify expected M sizes are present
		await expect(labelPage.getThreadSizeOption('M3')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('M4')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('M5')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('M6')).toBeVisible();
		await expect(labelPage.getThreadSizeOption('M8')).toBeVisible();

		// Verify ST-series sizes are NOT present
		expect(await labelPage.hasThreadSize('ST3.5')).toBe(false);

		// Verify plain decimal sizes are NOT present
		expect(await labelPage.hasThreadSize('3')).toBe(false);
		expect(await labelPage.hasThreadSize('3.5')).toBe(false);
	});
});
