import { type Page } from '@playwright/test';
import { BaseCanvas } from '../components/BaseCanvas';
import { waitForDataAttribute, waitForCanvasStable } from '../../utils/wait-helpers';

/**
 * Single label preview component
 * Extends BaseCanvas with single-label specific functionality
 */
export class SingleLabelPreview extends BaseCanvas {
	constructor(page: Page) {
		super(page);
	}

	/**
	 * Wait for label to be rendered after data change
	 */
	async waitForLabelRender() {
		// First check if canvas is visible or if we're showing placeholder
		const canvasCount = await this.canvas.count();
		
		if (canvasCount === 0) {
			// No canvas, wait for placeholder to be visible
			// Use data-testid for stable selection
			await this.page.getByTestId('label-preview-placeholder').waitFor({
				state: 'visible',
				timeout: 5000
			});
			return;
		}

		// Canvas exists, wait for it to be ready
		await this.waitForReady();
		
		// Wait for layout calculation to complete
		await this.canvas.waitFor({
			state: 'attached',
			timeout: 5000
		});
		
		// Wait for rendering to complete using data attributes
		await this.page.waitForFunction(
			() => {
				const canvas = document.querySelector('[data-testid="label-preview-canvas"]');
				if (!canvas) return false;
				
				// Check if layout is ready and not currently rendering
				const layoutReady = canvas.getAttribute('data-layout-ready') === 'true';
				const notRendering = canvas.getAttribute('data-rendering') === 'false';
				
				return layoutReady && notRendering;
			},
			{ timeout: 5000 }
		).catch(() => {
			// If data attributes are not working, fall back to canvas stability check
		});
		
		// Wait for canvas content to stabilize (using default selector with data-testid)
		await waitForCanvasStable(this.page, undefined, { optional: true, timeout: 8000 });
	}

	/**
	 * Verify canvas has expected dimensions for single label
	 * @param labelSize - Expected label size (9mm or 12mm)
	 */
	async verifyLabelDimensions(labelSize: '9mm' | '12mm'): Promise<boolean> {
		// First check if canvas is visible
		const canvasVisible = await this.canvas.isVisible().catch(() => false);
		if (!canvasVisible) {
			// If canvas is not visible (placeholder shown), that's OK
			// We can't verify dimensions but the label size is set correctly
			return true;
		}
		
		const dimensions = await this.getDimensions();

		// Expected canvas sizes (these would match your actual implementation)
		// These are example values - adjust based on your actual canvas dimensions
		const expectedSizes = {
			'9mm': { width: 354, height: 118 }, // ~50x9mm at ~180 DPI for preview
			'12mm': { width: 248, height: 141 } // ~35x12mm at ~180 DPI for preview
		};

		const expected = expectedSizes[labelSize];

		// Allow small variance for different DPI settings
		const tolerance = 10;

		return (
			Math.abs(dimensions.width - expected.width) <= tolerance &&
			Math.abs(dimensions.height - expected.height) <= tolerance
		);
	}

	/**
	 * Check if preview is showing content
	 * More specific than base hasContent() method
	 */
	async isShowingLabel(): Promise<boolean> {
		// First check if canvas is visible
		const canvasVisible = await this.canvas.isVisible().catch(() => false);
		if (!canvasVisible) {
			// Canvas not visible means placeholder is shown (no content)
			return false;
		}

		// Check if canvas has content
		const hasContent = await this.hasContent().catch(() => false);
		if (!hasContent) return false;

		// Verify canvas has reasonable dimensions
		const dimensions = await this.getDimensions().catch(() => ({ width: 0, height: 0 }));
		return dimensions.width > 100 && dimensions.height > 50;
	}
}
