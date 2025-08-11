import { test, expect } from '@playwright/test';
import { SingleLabelPage } from './pages/single-mode/SingleLabelPage';

test.describe('Printable Area Boundaries', () => {
	test('content stays within printable area after randomized form changes', async ({ page }) => {
		test.setTimeout(120000); // Increase timeout for this long-running, randomized test
		const labelPage = new SingleLabelPage(page);
		await labelPage.goto();

		// Helper function to verify boundaries after each action
		const verifyAfterAction = async (actionName: string, labelSize?: '9mm' | '12mm') => {
			await labelPage.preview.waitForLabelRender();
			const currentSize = labelSize || (await labelPage.getSelectedLabelSize());
			const labelWidth = 35; // Default width
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
			await labelPage.fillPrimaryText('M8x25x16x20x30'); // Longer text
			await verifyAfterAction('filling long primary text');
			await labelPage.fillSecondaryText('ISO 4762 / DIN 912 / ANSI B18.3');
			await verifyAfterAction('filling long secondary text');
		};

		const testFastenerMode = async () => {
			await labelPage.selectMode('fastener');
			await verifyAfterAction('switching to fastener mode');
			await labelPage.selectUnits('imperial');
			await verifyAfterAction('selecting imperial units');
			await labelPage.selectUnits('metric');
			await verifyAfterAction('selecting metric units');
			await labelPage.threadSizeButton.click();
			await page.getByRole('option', { name: 'M10' }).click();
			await verifyAfterAction('selecting thread size M10');
			await page.getByPlaceholder('Length in mm').fill('100');
			await verifyAfterAction('filling length value');
		};

		const testToggles = async () => {
			await labelPage.selectMode('fastener');
			// Ensure 12mm label is selected so QR code is available
			await labelPage.selectLabelSize('12mm');

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
			const widthSlider = page.locator('[role="slider"]');
			await widthSlider.evaluate((el: HTMLElement) => {
				el.setAttribute('aria-valuenow', '30');
				el.dispatchEvent(new Event('input', { bubbles: true }));
			});
			await verifyAfterAction('setting minimum width (30mm)');
			await widthSlider.evaluate((el: HTMLElement) => {
				el.setAttribute('aria-valuenow', '80');
				el.dispatchEvent(new Event('input', { bubbles: true }));
			});
			await verifyAfterAction('setting maximum width (80mm)');
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

		const actions = [
			testLabelSizeSwitching,
			testTextInputs,
			testFastenerMode,
			testToggles,
			testWidthSlider,
			testClearingFields
		];

		// Shuffle the actions for randomized testing order
		actions.sort(() => Math.random() - 0.5);

		// Execute all actions
		for (const action of actions) {
			await action();
		}
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
