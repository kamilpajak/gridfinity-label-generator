import { expect, test } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';
import { BatchModePage } from './pages/batch-mode/BatchModePage';

/**
 * UX Anti-Pattern Tests
 *
 * These tests detect common UX mistakes that confuse users.
 * They test for QUALITY, not just functionality.
 *
 * Anti-patterns tested:
 * 1. Checked + Disabled switches (confusing - user sees ON but can't interact)
 * 2. Inconsistent behavior between similar modes
 */

test.describe('UX Anti-Patterns Detection', () => {
	test('Single Mode: should NEVER have checked+disabled switches', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Test all switches in all relevant scenarios
		const scenarios = [
			{ mode: 'fastener' as const, height: '12mm' as const, description: 'Fastener 12mm' },
			{ mode: 'fastener' as const, height: '9mm' as const, description: 'Fastener 9mm' },
			{ mode: 'general' as const, height: '12mm' as const, description: 'General 12mm' },
			{ mode: 'general' as const, height: '9mm' as const, description: 'General 9mm' }
		];

		for (const scenario of scenarios) {
			// Set up scenario
			await labelPage.selectMode(scenario.mode);
			await labelPage.selectLabelSize(scenario.height);

			// Wait for switches to be fully rendered
			await expect(labelPage.hardwareImageSwitch).toBeVisible();

			// Check all switches
			const switches = [
				{
					name: 'Hardware Image',
					element: labelPage.hardwareImageSwitch,
					testId: 'hardware-image-switch'
				},
				{
					name: 'QR Code',
					element: labelPage.qrCodeSwitch,
					testId: 'qr-code-switch'
				},
				{
					name: 'Standard Reference',
					element: labelPage.standardReferenceSwitch,
					testId: 'standard-reference-switch'
				}
			];

			for (const switchInfo of switches) {
				const isDisabled = await switchInfo.element.isDisabled();
				const isChecked = await switchInfo.element.isChecked();

				// UX ANTI-PATTERN CHECK:
				// If a switch is disabled, it MUST NOT be checked
				// (checked+disabled = confusing UX)
				if (isDisabled && isChecked) {
					throw new Error(
						`UX ANTI-PATTERN DETECTED in ${scenario.description}:\n` +
							`Switch "${switchInfo.name}" (${switchInfo.testId}) is CHECKED but DISABLED.\n` +
							`This confuses users who see an active feature they cannot interact with.\n` +
							`FIX: Set checked=false when switch becomes disabled.`
					);
				}
			}
		}
	});

	test('Batch Mode: should NEVER have checked+disabled switches', async ({ page }) => {
		// Batch mode shares the single-mode form. The switches here are the shared
		// standard-reference-switch / hardware-image-switch / qr-code-switch.
		const batchPage = new BatchModePage(page);
		const form = new SingleModePage(page);
		await batchPage.goto();

		const scenarios = [
			{ mode: 'fastener' as const, height: '12mm' as const, description: 'Fastener 12mm' },
			{ mode: 'fastener' as const, height: '9mm' as const, description: 'Fastener 9mm' },
			{ mode: 'general' as const, height: '12mm' as const, description: 'General 12mm' },
			{ mode: 'general' as const, height: '9mm' as const, description: 'General 9mm' }
		];

		for (const scenario of scenarios) {
			// Tape height is a global batch setting; mode uses the shared form toggle.
			await batchPage.selectTapeHeight(scenario.height);
			await form.selectMode(scenario.mode);

			await expect(form.hardwareImageSwitch).toBeVisible();

			const switches = [
				{
					name: 'Hardware Image',
					element: form.hardwareImageSwitch,
					testId: 'hardware-image-switch'
				},
				{ name: 'QR Code', element: form.qrCodeSwitch, testId: 'qr-code-switch' },
				{
					name: 'Standard Reference',
					element: form.standardReferenceSwitch,
					testId: 'standard-reference-switch'
				}
			];

			for (const switchInfo of switches) {
				const isDisabled = await switchInfo.element.isDisabled();
				const isChecked = await switchInfo.element.isChecked();

				// UX ANTI-PATTERN CHECK
				if (isDisabled && isChecked) {
					throw new Error(
						`UX ANTI-PATTERN DETECTED in Batch Mode ${scenario.description}:\n` +
							`Switch "${switchInfo.name}" (${switchInfo.testId}) is CHECKED but DISABLED.\n` +
							`This confuses users who see an active feature they cannot interact with.\n` +
							`FIX: Set checked=false when switch becomes disabled.`
					);
				}
			}
		}
	});

	test('should provide helpful error message when anti-pattern is detected', async ({ page }) => {
		// This test documents WHAT to do when the anti-pattern is detected
		// It serves as documentation for future developers

		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Example of correct behavior:
		await labelPage.selectMode('general');

		const hardwareImageDisabled = await labelPage.hardwareImageSwitch.isDisabled();
		const hardwareImageChecked = await labelPage.hardwareImageSwitch.isChecked();

		// CORRECT: In general mode, hardware image is disabled AND unchecked
		expect(hardwareImageDisabled).toBe(true);
		expect(hardwareImageChecked).toBe(false);

		// Documentation in test:
		// If this test fails, it means:
		// 1. Switch is disabled (correct - not available in general mode)
		// 2. BUT switch is also checked (WRONG - confusing UX)
		//
		// FIX: Add $effect to automatically uncheck when switching to general mode:
		//
		// $effect(() => {
		//   if (labelMode === 'general') {
		//     untrack(() => {
		//       if (showHardwareImage) {
		//         showHardwareImage = false;
		//       }
		//     });
		//   }
		// });
	});
});
