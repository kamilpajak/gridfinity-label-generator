/**
 * Single Mode vs Batch Mode Rendering Comparison Test
 *
 * Validates that rendering the same label through single mode export
 * and batch mode export (with 1 label) produces IDENTICAL pixel output.
 *
 * This is a critical test to ensure both rendering pipelines are truly unified.
 */

import { test, expect } from '@playwright/test';
import { RenderComparisonPage } from './pages/harness/RenderComparisonPage';

test.describe('Single vs Batch Mode Rendering', () => {
	test('should produce pixel-perfect identical output for same label configuration', async ({
		page
	}) => {
		const renderComparison = new RenderComparisonPage(page);

		// Navigate to test page that renders both modes
		await renderComparison.goto();

		// Wait for rendering to complete (status changes from "Ready" to "Rendered successfully")
		await renderComparison.waitForRendered();

		// Get canvas data from both modes
		const singleModeCanvasData = await renderComparison.getSingleCanvasData();
		const batchModeCanvasData = await renderComparison.getBatchCanvasData();

		// === PIXEL-PERFECT COMPARISON ===
		// Dimensions must match
		expect(singleModeCanvasData.width).toBe(batchModeCanvasData.width);
		expect(singleModeCanvasData.height).toBe(batchModeCanvasData.height);

		// Pixel data must be IDENTICAL (100% match, zero tolerance)
		const totalPixels = singleModeCanvasData.width * singleModeCanvasData.height;
		const totalBytes = totalPixels * 4; // RGBA

		let differentPixels = 0;
		const maxDiffsToShow = 10;
		const differences: Array<{ index: number; single: number[]; batch: number[] }> = [];

		for (let i = 0; i < totalBytes; i += 4) {
			const singleR = singleModeCanvasData.data[i];
			const singleG = singleModeCanvasData.data[i + 1];
			const singleB = singleModeCanvasData.data[i + 2];
			const singleA = singleModeCanvasData.data[i + 3];

			const batchR = batchModeCanvasData.data[i];
			const batchG = batchModeCanvasData.data[i + 1];
			const batchB = batchModeCanvasData.data[i + 2];
			const batchA = batchModeCanvasData.data[i + 3];

			if (singleR !== batchR || singleG !== batchG || singleB !== batchB || singleA !== batchA) {
				differentPixels++;

				if (differences.length < maxDiffsToShow) {
					const pixelIndex = i / 4;

					differences.push({
						index: pixelIndex,
						single: [singleR, singleG, singleB, singleA],
						batch: [batchR, batchG, batchB, batchA]
					});
				}
			}
		}

		// Generate detailed error message if there are differences
		if (differentPixels > 0) {
			const percentDifferent = ((differentPixels / totalPixels) * 100).toFixed(4);

			let errorMessage = `Pixel-perfect comparison FAILED!\n\n`;
			errorMessage += `Canvas size: ${singleModeCanvasData.width}x${singleModeCanvasData.height}\n`;
			errorMessage += `Total pixels: ${totalPixels}\n`;
			errorMessage += `Different pixels: ${differentPixels} (${percentDifferent}%)\n\n`;
			errorMessage += `First ${Math.min(differentPixels, maxDiffsToShow)} differences:\n`;

			differences.forEach((diff, idx) => {
				const x = diff.index % singleModeCanvasData.width;
				const y = Math.floor(diff.index / singleModeCanvasData.width);
				errorMessage += `  ${idx + 1}. Pixel (${x}, ${y}):\n`;
				errorMessage += `     Single: RGBA(${diff.single.join(', ')})\n`;
				errorMessage += `     Batch:  RGBA(${diff.batch.join(', ')})\n`;
			});

			throw new Error(errorMessage);
		}

		// SUCCESS - All pixels are identical!
		expect(differentPixels).toBe(0);
	});
});
