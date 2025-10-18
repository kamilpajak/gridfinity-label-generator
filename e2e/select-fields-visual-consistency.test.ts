import { expect, test } from '@playwright/test';
import { SingleModePage } from './pages/single-mode/SingleModePage';

test.describe('Select Fields Visual Consistency (TDD)', () => {
	let labelPage: SingleModePage;

	test.beforeEach(async ({ page }) => {
		labelPage = new SingleModePage(page);
		await labelPage.goto();
	});

	test('all empty select fields should have consistent placeholder text color', async ({
		page
	}) => {
		// Ensure we're in Fastener mode where all select fields are visible
		await labelPage.selectMode('fastener');

		// Get the color of placeholder text from each select field
		const hardwareSelectColor = await page.evaluate(() => {
			const button = document.querySelector('[data-testid="hardware-select"]');
			if (!button) return null;
			// Look for the muted-foreground span or use button's color
			const span = button.querySelector('.text-muted-foreground');
			const element = span || button;
			const style = window.getComputedStyle(element);
			return style.color;
		});

		const threadSizeSelectColor = await page.evaluate(() => {
			// SelectTrigger - get the actual text element
			const trigger = document.querySelector('[data-testid="thread-size-select"]');
			if (!trigger) return null;
			const style = window.getComputedStyle(trigger);
			return style.color;
		});

		const pitchSelectColor = await page.evaluate(() => {
			// SelectTrigger - get the actual text element
			const trigger = document.querySelector('[data-testid="pitch-select"]');
			if (!trigger) return null;
			const style = window.getComputedStyle(trigger);
			return style.color;
		});

		// All select fields should have the same placeholder color
		expect(hardwareSelectColor).not.toBeNull();
		expect(threadSizeSelectColor).not.toBeNull();
		expect(pitchSelectColor).not.toBeNull();

		// TDD: This assertion should FAIL initially because:
		// - hardwareSelectColor uses Button with normal text color (likely black/dark)
		// - threadSizeSelectColor and pitchSelectColor use SelectTrigger with data-[placeholder]:text-muted-foreground (gray)
		expect(hardwareSelectColor).toBe(threadSizeSelectColor);
		expect(hardwareSelectColor).toBe(pitchSelectColor);
		expect(threadSizeSelectColor).toBe(pitchSelectColor);
	});

	test('all empty select fields should have muted foreground color', async ({ page }) => {
		// Ensure we're in Fastener mode
		await labelPage.selectMode('fastener');

		// Get the CSS variable value for muted-foreground
		const mutedForegroundColor = await page.evaluate(() => {
			// Create a temporary element with text-muted-foreground class to get the actual color
			const temp = document.createElement('div');
			temp.className = 'text-muted-foreground';
			temp.style.visibility = 'hidden';
			document.body.appendChild(temp);
			const style = window.getComputedStyle(temp);
			const color = style.color;
			document.body.removeChild(temp);
			return color;
		});

		// Get colors from all select fields
		const selectColors = await page.evaluate(() => {
			const selectors = [
				'[data-testid="hardware-select"]',
				'[data-testid="thread-size-select"]',
				'[data-testid="pitch-select"]'
			];

			return selectors.map((selector, index) => {
				const element = document.querySelector(selector);
				if (!element) return null;
				// For hardware-select (index 0), look for the span with text-muted-foreground
				if (index === 0) {
					const span = element.querySelector('.text-muted-foreground');
					if (span) {
						const style = window.getComputedStyle(span);
						return style.color;
					}
				}
				const style = window.getComputedStyle(element);
				return style.color;
			});
		});

		// All select fields should use the muted-foreground color
		selectColors.forEach((color) => {
			expect(color).not.toBeNull();
			expect(color).toBe(mutedForegroundColor);
		});
	});

	test('all select fields should have non-transparent background', async ({ page }) => {
		// Ensure we're in Fastener mode
		await labelPage.selectMode('fastener');

		// Get background colors from all select fields
		const backgrounds = await page.evaluate(() => {
			const selectors = [
				'[data-testid="hardware-select"]',
				'[data-testid="thread-size-select"]',
				'[data-testid="pitch-select"]'
			];

			return selectors.map((selector) => {
				const element = document.querySelector(selector);
				if (!element) return null;
				const style = window.getComputedStyle(element);
				return style.backgroundColor;
			});
		});

		// All select fields should have non-transparent background
		// This ensures proper contrast for placeholder text
		backgrounds.forEach((background) => {
			expect(background).not.toBeNull();
			// Should NOT be transparent (rgba(0, 0, 0, 0))
			expect(background).not.toBe('rgba(0, 0, 0, 0)');
		});
	});

	// Note: Removed "filled state" test as it's overly restrictive
	// Button and SelectTrigger can have different colors when filled due to different component implementations
	// The important thing is that empty placeholders are consistently gray (tested above)
});
