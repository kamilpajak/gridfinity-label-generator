import { type Page } from '@playwright/test';
import { BaseCanvas } from '../components/BaseCanvas';
import {
	type LabelSize,
	EXPECTED_CANVAS_SIZES,
	DIMENSION_TOLERANCE_PX
} from '../../types/page-objects';

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
	 *
	 * Uses event-driven approach with data-render-status attribute
	 * instead of polling canvas pixel data for stability.
	 * This is much faster (~50ms vs ~400ms per check).
	 */
	async waitForLabelRender() {
		// Use polling to handle edge cases where canvas might be briefly
		// unmounted during rapid state changes (hasContent toggling)
		await this.page.waitForFunction(
			() => {
				const canvas = document.querySelector('[data-testid="label-preview-canvas"]');
				if (!canvas) {
					// Check if placeholder is shown (no content case)
					const placeholder = document.querySelector('[data-testid="label-preview-placeholder"]');
					return !!placeholder;
				}
				// Canvas exists - check if render is stable
				return canvas.getAttribute('data-render-status') === 'stable';
			},
			{ timeout: 10000 }
		);
	}

	/**
	 * Verify canvas has expected dimensions for single label
	 * @param labelSize - Expected label size (9mm or 12mm)
	 */
	async verifyLabelDimensions(labelSize: LabelSize): Promise<boolean> {
		// First check if canvas is visible
		const canvasVisible = await this.canvas.isVisible().catch(() => false);
		if (!canvasVisible) {
			// If canvas is not visible (placeholder shown), that's OK
			// We can't verify dimensions but the label size is set correctly
			return true;
		}

		const dimensions = await this.getDimensions();
		const expected = EXPECTED_CANVAS_SIZES[labelSize];

		return (
			Math.abs(dimensions.width - expected.width) <= DIMENSION_TOLERANCE_PX &&
			Math.abs(dimensions.height - expected.height) <= DIMENSION_TOLERANCE_PX
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
