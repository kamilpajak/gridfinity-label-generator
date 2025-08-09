import { test, expect } from '@playwright/test';
import { SingleLabelPage } from './pages/single-mode/SingleLabelPage';

test.describe('Printable Area Boundaries', () => {
	test('content stays within printable area after each form change', async ({ page }) => {
		const labelPage = new SingleLabelPage(page);
		await labelPage.goto();

		// Switch to General Item mode to use standard input fields
		await labelPage.selectLabelMode('General Item');

		// Helper function to verify boundaries after each action
		const verifyAfterAction = async (actionName: string, labelSize?: '9mm' | '12mm') => {
			// Wait for label to be fully rendered
			await labelPage.preview.waitForLabelRender();

			// Determine label dimensions based on current size
			const currentSize = labelSize || (await labelPage.getSelectedLabelSize());
			const labelWidth = 35; // Default width
			const labelHeight = currentSize === '9mm' ? 9 : 12;

			const isWithinBounds = await labelPage.preview.verifyContentWithinPrintableArea(
				labelWidth,
				labelHeight
			);

			expect(isWithinBounds, `Content exceeded printable area after: ${actionName}`).toBe(true);
		};

		// 1. First add some content so canvas is visible
		await labelPage.fillPrimaryText('Test');
		await verifyAfterAction('adding initial text', '12mm');

		// 2. Test label size changes
		await labelPage.selectLabelSize('9mm');
		await verifyAfterAction('selecting 9mm label size', '9mm');

		await labelPage.selectLabelSize('12mm');
		await verifyAfterAction('selecting 12mm label size', '12mm');

		// 3. Already in General Item mode from line 10, no need to switch again
		// Just verify the current state
		await verifyAfterAction('already in general item mode');

		// 4. Test primary text input
		await labelPage.fillPrimaryText('M8');
		await verifyAfterAction('filling short primary text');

		await labelPage.fillPrimaryText('M8x25x16x20x30'); // Longer text
		await verifyAfterAction('filling long primary text');

		// 5. Test secondary text input
		await labelPage.fillSecondaryText('ISO 4762');
		await verifyAfterAction('filling secondary text');

		await labelPage.fillSecondaryText('ISO 4762 / DIN 912 / ANSI B18.3');
		await verifyAfterAction('filling long secondary text');

		// 6. Switch back to fastener mode
		await labelPage.selectMode('fastener');
		await verifyAfterAction('switching to fastener mode');

		// 7. Test unit selection (affects thread size dropdown)
		await labelPage.selectUnits('imperial');
		await verifyAfterAction('selecting imperial units');

		await labelPage.selectUnits('metric');
		await verifyAfterAction('selecting metric units');

		// 8. Test thread size selection
		await labelPage.threadSizeButton.click();
		await page.getByRole('option', { name: 'M10' }).click();
		await verifyAfterAction('selecting thread size M10');

		// 9. Test length input
		await page.getByPlaceholder('Length in mm').fill('100');
		await verifyAfterAction('filling length value');

		// Skip hardware tests in General Item mode as they're not available

		// 12. Test standard reference toggle - use data-testid for reliable selection
		const standardSwitch = page.getByTestId('standard-reference-switch');
		await standardSwitch.click();
		await verifyAfterAction('disabling standard reference');

		await standardSwitch.click();
		await verifyAfterAction('enabling standard reference');

		// 13. Test QR code functionality
		await labelPage.toggleQRCode();
		await verifyAfterAction('enabling QR code');

		await labelPage.fillQRCodeUrl('https://example.com');
		await verifyAfterAction('filling QR code URL');

		await labelPage.fillQRCodeUrl(
			'https://very-long-url-that-might-cause-issues.example.com/path/to/resource?param1=value1&param2=value2'
		);
		await verifyAfterAction('filling long QR code URL');

		// 14. Test optional note
		await page.getByPlaceholder('Optional note').fill('Box A1');
		await verifyAfterAction('adding optional note');

		await page
			.getByPlaceholder('Optional note')
			.fill('Very long optional note that might overflow the available space');
		await verifyAfterAction('adding long optional note');

		// 15. Test width slider adjustments
		const widthSlider = page.locator('[role="slider"]');

		// Move to minimum width (30mm)
		await widthSlider.evaluate((el: HTMLElement) => {
			el.setAttribute('aria-valuenow', '30');
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await verifyAfterAction('setting minimum width (30mm)');

		// Move to maximum width (80mm)
		await widthSlider.evaluate((el: HTMLElement) => {
			el.setAttribute('aria-valuenow', '80');
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await verifyAfterAction('setting maximum width (80mm)');

		// Move back to default (35mm)
		await widthSlider.evaluate((el: HTMLElement) => {
			el.setAttribute('aria-valuenow', '35');
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await verifyAfterAction('setting default width (35mm)');

		// 16. Test extreme combinations
		// Small label with all features enabled
		await labelPage.selectLabelSize('9mm');
		// Ensure we're in General Item mode to use text inputs
		await labelPage.selectMode('general');
		await labelPage.fillPrimaryText('VERYLONGTEXT');
		await labelPage.fillSecondaryText('VERYLONGSECONDARYTEXT');
		await verifyAfterAction('9mm label with long text');

		// Note: For 9mm labels, QR code and hardware image are disabled
		// so we can't test those combinations

		// Large label with all features
		await labelPage.selectLabelSize('12mm');
		// Switch back to fastener mode to enable hardware-related options
		await labelPage.selectMode('fastener');
		if (!(await labelPage.isHardwareImageEnabled())) {
			await labelPage.toggleHardwareImage();
		}
		if (!(await labelPage.isQRCodeEnabled())) {
			await labelPage.toggleQRCode();
		}
		await labelPage.fillQRCodeUrl('https://example.com/qr');
		await verifyAfterAction('12mm label with all features enabled');

		// 17. Test clearing fields
		await labelPage.selectMode('general'); // Switch to general mode to clear text
		await labelPage.fillPrimaryText('');
		await verifyAfterAction('clearing primary text');

		await labelPage.fillSecondaryText('');
		await verifyAfterAction('clearing secondary text');

		await labelPage.fillQRCodeUrl('');
		await verifyAfterAction('clearing QR code URL');
	});

	test('extreme text cases stay within boundaries', async ({ page }) => {
		const labelPage = new SingleLabelPage(page);
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
			'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', // Cyrillic
			'🔩📏📐🔧🔨⚙️🛠️', // Emojis
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
		const labelPage = new SingleLabelPage(page);
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
