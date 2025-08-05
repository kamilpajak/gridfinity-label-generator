import { type Page } from '@playwright/test';
import { BaseCanvas } from '../components/BaseCanvas';

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
		await this.waitForReady();
		// Additional wait for font loading and image rendering
		await this.page.waitForTimeout(200);
	}

	/**
	 * Verify canvas has expected dimensions for single label
	 * @param labelSize - Expected label size (9mm or 12mm)
	 */
	async verifyLabelDimensions(labelSize: '9mm' | '12mm'): Promise<boolean> {
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
		if (!(await this.hasContent())) return false;

		// Could be extended to check for specific elements
		// For now, just verify canvas is visible and has dimensions
		const dimensions = await this.getDimensions();
		return dimensions.width > 100 && dimensions.height > 50;
	}
}
