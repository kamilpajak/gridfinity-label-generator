/**
 * Batch Tape PNG Export Utility
 *
 * Exports batch tape to high-quality PNG files for printing.
 */

import { renderBatchTape } from './batch-renderer';
import type { BatchState } from '$lib/types/batch';

export interface BatchExportOptions {
	batch: BatchState;
	dpi?: number;
}

const DEFAULT_DPI = 360;

/**
 * Exports a batch tape to PNG format using canvas
 */
export async function exportBatchTapeAsPNG(options: BatchExportOptions): Promise<void> {
	const { batch, dpi = DEFAULT_DPI } = options;

	// Validate batch has labels
	if (batch.labels.length === 0) {
		throw new Error('Cannot export empty batch');
	}

	// Create high-res canvas for export
	const exportCanvas = document.createElement('canvas');

	// Render batch tape to canvas
	try {
		await renderBatchTape({
			canvas: exportCanvas,
			batch,
			dpi,
			showMargins: false // No margins in export
		});
	} catch (error) {
		if (import.meta.env.DEV) {
			console.error('Failed to render batch tape:', error);
		}
		throw error;
	}

	// Generate filename with timestamp
	const filename = generateBatchFilename(batch.labels.length);

	// Download the canvas
	await downloadCanvasAsPng(exportCanvas, filename);
}

/**
 * Generates filename with timestamp
 * Format: batch_{timestamp}.png (e.g., batch_20250102_143052.png)
 */
function generateBatchFilename(labelCount: number): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	return `batch_${year}${month}${day}_${hours}${minutes}${seconds}_${labelCount}labels.png`;
}

/**
 * Downloads canvas content as PNG file
 */
function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
	// Check if we're in a browser environment
	if (typeof document === 'undefined' || !document.body) {
		if (import.meta.env.DEV) {
			console.error('Download not available - not in browser environment');
		}
		return Promise.reject(new Error('Download not available in this environment'));
	}

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				if (import.meta.env.DEV) {
					console.error('Failed to create PNG blob');
				}
				reject(new Error('Failed to create PNG blob'));
				return;
			}

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.style.display = 'none';
			document.body.appendChild(a);

			// Use requestAnimationFrame to ensure the link is in the DOM and browser is ready
			requestAnimationFrame(() => {
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				resolve();
			});
		}, 'image/png');
	});
}
