/**
 * Label Settings Responsive Behavior Tests
 *
 * Validates that the Label Settings section works correctly on both
 * mobile (collapsible) and desktop (always visible Card) viewports.
 */

import { test, expect } from '@playwright/test';
import { LabelSettingsComponent } from './pages/components/LabelSettings';

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

test.describe('Label Settings Responsive Behavior', () => {
	test.describe('Mobile Viewport', () => {
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize(MOBILE_VIEWPORT);
			await page.goto('/');
		});

		test('settings section is collapsed by default on mobile', async ({ page }) => {
			const labelSettings = new LabelSettingsComponent(page);

			// Should be in mobile view
			expect(await labelSettings.isMobileView()).toBe(true);

			// The collapsible header should be visible with chevron
			await expect(labelSettings.mobileCollapsibleButton).toBeVisible();
			await expect(labelSettings.mobileChevronIcon).toBeVisible();
		});

		test('collapsible button is visible only on mobile', async ({ page }) => {
			const labelSettings = new LabelSettingsComponent(page);

			// On mobile, the button should be visible
			await expect(labelSettings.mobileCollapsibleButton).toBeVisible();

			// Resize to desktop
			await page.setViewportSize(DESKTOP_VIEWPORT);

			// On desktop, the button should be hidden
			await expect(labelSettings.mobileCollapsibleButton).toBeHidden();
		});
	});

	test.describe('Desktop Viewport', () => {
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize(DESKTOP_VIEWPORT);
			await page.goto('/');
		});

		test('settings section is always visible on desktop (Card format)', async ({ page }) => {
			const labelSettings = new LabelSettingsComponent(page);

			// Should NOT be in mobile view
			expect(await labelSettings.isMobileView()).toBe(false);

			// The switches should be visible immediately (may need scroll)
			const standardSwitch = labelSettings.getVisibleStandardSwitch();
			await standardSwitch.scrollIntoViewIfNeeded();
			await expect(standardSwitch).toBeVisible();
		});

		test('all settings controls are visible on desktop', async ({ page }) => {
			const labelSettings = new LabelSettingsComponent(page);

			// Scroll to settings area first
			const standardSwitch = labelSettings.getVisibleStandardSwitch();
			await standardSwitch.scrollIntoViewIfNeeded();

			await expect(standardSwitch).toBeVisible();
			await expect(labelSettings.getVisibleHardwareSwitch()).toBeVisible();
			await expect(labelSettings.getVisibleQRSwitch()).toBeVisible();
			await expect(labelSettings.getVisibleHeightToggle()).toBeVisible();
		});

		test('height toggle default value on desktop', async ({ page }) => {
			const labelSettings = new LabelSettingsComponent(page);

			// Default should be 12mm
			expect(await labelSettings.isHeight12mmSelected()).toBe(true);
			expect(await labelSettings.isHeight9mmSelected()).toBe(false);
		});
	});
});
