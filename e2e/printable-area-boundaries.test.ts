import { test, expect } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

/**
 * TODO: Possible improvements for this test suite:
 * 1. Extract helper functions to a shared test utilities file
 * 2. Add more specific boundary tests for edge cases (e.g., 100mm screw length on 35mm label)
 * 3. Consider adding visual regression tests for boundary violations
 * 4. Parameterize test scenarios instead of hard-coding test functions
 * 5. Add performance benchmarks to detect layout calculation slowdowns
 * 6. Test boundary behavior with different DPI settings
 * 7. Add tests for margin guidelines rendering accuracy
 * 8. Consider splitting into separate test files by feature (slider, text, toggles, etc.)
 */

test.describe('Printable Area Boundaries', () => {
	test('content stays within printable area after randomized form changes', async ({ page }) => {
		// Uses global timeout from playwright.config.ts (60s on CI, 30s locally)
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Helper function to verify boundaries after each action
		const verifyAfterAction = async (actionName: string, labelSize?: '9mm' | '12mm') => {
			await labelPage.preview.waitForLabelRender();
			const currentSize = labelSize || (await labelPage.getSelectedLabelSize());
			// Get current label width from the slider
			const labelWidth = await labelPage.getLabelWidth();
			const labelHeight = currentSize === '9mm' ? 9 : 12;
			const isWithinBounds = await labelPage.preview.verifyContentWithinPrintableArea(
				labelWidth,
				labelHeight
			);
			expect(isWithinBounds, `Content exceeded printable area after: ${actionName}`).toBe(true);
		};

		// --- Test Action Definitions ---

		const testLabelSizeSwitching = async () => {
			await labelPage.selectLabelSize('9mm');
			await verifyAfterAction('selecting 9mm label size', '9mm');
			await labelPage.selectLabelSize('12mm');
			await verifyAfterAction('selecting 12mm label size', '12mm');
		};

		const testTextInputs = async () => {
			await labelPage.selectMode('general');
			await labelPage.fillPrimaryText('M8');
			await verifyAfterAction('filling short primary text');
			await labelPage.fillPrimaryText('M8 x 25'); // Realistic longer text
			await verifyAfterAction('filling long primary text');
			await labelPage.fillSecondaryText('ISO 4762');
			await verifyAfterAction('filling secondary text');
		};

		const testFastenerMode = async () => {
			await labelPage.selectMode('fastener');
			await verifyAfterAction('switching to fastener mode');

			// Select a hardware type that allows length input (screw)
			await labelPage.selectHardwareByName('ISO', /Hexagon socket head cap screws/);
			await verifyAfterAction('selecting hardware with length support');

			await labelPage.selectUnits('imperial');
			await verifyAfterAction('selecting imperial units');
			await labelPage.selectUnits('metric');
			await verifyAfterAction('selecting metric units');
			await labelPage.selectThreadSize('M10');
			await verifyAfterAction('selecting thread size M10');

			// Use realistic length value for screw (100mm is valid)
			await labelPage.fillLength('100');
			await verifyAfterAction('filling length value');
		};

		const testToggles = async () => {
			await labelPage.selectMode('fastener');
			// Ensure 12mm label is selected so QR code is available
			await labelPage.selectLabelSize('12mm');

			// Set width to 50mm to allow both hardware image and QR code
			// (UI constraint: labelWidth < 50 disables one when both are active)
			await labelPage.setLabelWidth(50);
			await verifyAfterAction('setting width to 50mm for QR code + hardware test');

			await labelPage.toggleStandardReference();
			await verifyAfterAction('disabling standard reference');
			await labelPage.toggleStandardReference();
			await verifyAfterAction('enabling standard reference');
			await labelPage.toggleQRCode();
			await verifyAfterAction('enabling QR code');
			await labelPage.fillQRCodeUrl('https://example.com');
			await verifyAfterAction('filling QR code URL');
		};

		const testWidthSlider = async () => {
			// Reset to General Item mode with minimal content to test extreme widths
			await labelPage.selectMode('general');
			await labelPage.fillPrimaryText('M8');
			await labelPage.fillSecondaryText('');

			// Test minimum width (35mm)
			await labelPage.setLabelWidth(35);
			await verifyAfterAction('setting minimum width (35mm)');
			// Test maximum width (100mm)
			await labelPage.setLabelWidth(100);
			await verifyAfterAction('setting maximum width (100mm)');
		};

		const testClearingFields = async () => {
			await labelPage.selectMode('general');
			await labelPage.fillPrimaryText('');
			await verifyAfterAction('clearing primary text');
			await labelPage.fillSecondaryText('');
			await verifyAfterAction('clearing secondary text');
			// Only try to clear QR code if it's enabled
			const qrEnabled = await labelPage.isQRCodeEnabled();
			if (qrEnabled) {
				await labelPage.fillQRCodeUrl('');
				await verifyAfterAction('clearing QR code URL');
			}
		};

		// --- Test Execution ---

		// Initial setup: ensure canvas is visible
		await labelPage.selectLabelMode('General Item');
		await labelPage.fillPrimaryText('Initial Text');
		await verifyAfterAction('initial setup');

		// Execute actions in deterministic order to ensure test stability
		// Order is important: wider labels/fewer elements first, then narrow/complex
		await testLabelSizeSwitching();
		await testWidthSlider(); // Sets width to 35mm and 100mm
		await testTextInputs(); // Moderate content
		await testToggles(); // Sets width to 50mm for QR + hardware
		await testFastenerMode(); // Complex: M10 × 100 + hardware + standard
		await testClearingFields();
	});

	test('dynamic content changes maintain boundaries', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode
		await labelPage.selectLabelMode('General Item');

		// Create a label with all features (no hardware since we're in general mode)
		await labelPage.createCompleteLabel({
			size: '12mm',
			primaryText: 'M8x25',
			secondaryText: 'ISO 4762',
			qrUrl: 'https://example.com'
		});

		// Verify initial state
		let isWithinBounds = await labelPage.preview.verifyContentWithinPrintableArea();
		expect(isWithinBounds).toBe(true);

		// Rapidly change multiple settings
		for (let i = 0; i < 5; i++) {
			await labelPage.fillPrimaryText(`M${i * 2}x${i * 10}`);
			await labelPage.toggleQRCode();

			isWithinBounds = await labelPage.preview.verifyContentWithinPrintableArea();
			expect(isWithinBounds, `Failed after rapid change iteration ${i}`).toBe(true);
		}
	});
});
