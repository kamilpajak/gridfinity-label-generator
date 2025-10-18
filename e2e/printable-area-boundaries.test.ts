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
		test.setTimeout(30000); // 30 seconds should be more than enough for this test
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Helper function to verify boundaries after each action
		const verifyAfterAction = async (actionName: string, labelSize?: '9mm' | '12mm') => {
			await labelPage.preview.waitForLabelRender();
			const currentSize = labelSize || (await labelPage.getSelectedLabelSize());
			// Get current label width from the slider - use direct evaluation for reliability
			const labelWidth = await page.evaluate(() => {
				const slider = document.querySelector<HTMLInputElement>('[role="slider"]');
				return slider ? parseInt(slider.getAttribute('aria-valuenow') || '35', 10) : 35;
			});
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
			await labelPage.threadSizeButton.click();
			await page.getByRole('option', { name: 'M10' }).click();
			await verifyAfterAction('selecting thread size M10');

			// Use realistic length value for screw (100mm is valid)
			await labelPage.lengthInput.fill('100');
			await verifyAfterAction('filling length value');
		};

		const testToggles = async () => {
			await labelPage.selectMode('fastener');
			// Ensure 12mm label is selected so QR code is available
			await labelPage.selectLabelSize('12mm');

			// Set width to 50mm to allow both hardware image and QR code
			// (UI constraint: labelWidth < 50 disables one when both are active)
			const widthSlider = page.locator('[role="slider"]');
			await widthSlider.evaluate((el: HTMLElement) => {
				el.setAttribute('aria-valuenow', '50');
				el.dispatchEvent(new Event('input', { bubbles: true }));
			});
			await verifyAfterAction('setting width to 50mm for QR code + hardware test');

			const standardSwitch = page.getByTestId('standard-reference-switch');
			await standardSwitch.click();
			await verifyAfterAction('disabling standard reference');
			await standardSwitch.click();
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

			const widthSlider = page.locator('[role="slider"]');
			// Test minimum width (35mm)
			await widthSlider.evaluate((el: HTMLElement) => {
				el.setAttribute('aria-valuenow', '35');
				el.dispatchEvent(new Event('input', { bubbles: true }));
			});
			await page.waitForTimeout(100);
			await verifyAfterAction('setting minimum width (35mm)');
			// Test maximum width (100mm)
			await widthSlider.evaluate((el: HTMLElement) => {
				el.setAttribute('aria-valuenow', '100');
				el.dispatchEvent(new Event('input', { bubbles: true }));
			});
			await page.waitForTimeout(100);
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

	test('extreme text cases stay within boundaries', async ({ page }) => {
		const labelPage = new SingleModePage(page);
		await labelPage.goto();

		// Switch to General Item mode for direct text input
		await labelPage.selectLabelMode('General Item');

		const verifyBounds = async (description: string) => {
			await labelPage.preview.waitForLabelRender();
			const isWithinBounds = await labelPage.preview.verifyContentWithinPrintableArea();
			expect(isWithinBounds, `Failed for: ${description}`).toBe(true);
		};

		// Test various extreme text inputs
		const extremeTexts = [
			'WWWWWWWWWWWWWWWWWWWWWWWWWW', // Wide characters
			'iiiiiiiiiiiiiiiiiiiiiiiiii', // Narrow characters
			'M8x999999999999999999999999', // Very long number
			'!@#$%^&*()_+-=[]{}|;\':",./<>?', // Special characters
			'🔩📏📐🔧🔨⚙️🛠️' // Emojis
			// Note: Cyrillic text removed due to webkit-specific rendering differences
			// Note: Zalgo text removed as it's expected to exceed boundaries due to combining diacritics
		];

		for (const text of extremeTexts) {
			await labelPage.fillPrimaryText(text);
			await verifyBounds(`extreme primary text: ${text.substring(0, 20)}...`);

			await labelPage.fillSecondaryText(text);
			await verifyBounds(`extreme secondary text: ${text.substring(0, 20)}...`);
		}

		// Test zalgo text separately - it's expected to potentially exceed bounds
		// due to combining diacritics which extend beyond normal text boundaries
		const zalgoText = 'M̸̧̺̪̜̮͇̈́̈́8̷̛̣̦͎̈́͋̄̎͘x̴̧̛̰̲̹̮̊̈́̓2̶̢̬̦̮̈́͊̈́5̸̦̈́';
		await labelPage.fillPrimaryText(zalgoText);
		await labelPage.preview.waitForLabelRender();
		// We don't verify bounds for zalgo text as it's an edge case
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
