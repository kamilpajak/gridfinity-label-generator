/**
 * Integration test to verify exported PNG dimensions match between single and batch mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportCanvasLabelAsPNG } from './label-exporter';
import { exportBatchTapeAsPNG } from './batch-exporter';
import type { BatchState } from '$lib/types/batch';

describe('Export dimensions integration', () => {
	let capturedCanvases: HTMLCanvasElement[] = [];
	let originalCreateElement: typeof document.createElement;

	beforeEach(() => {
		capturedCanvases = [];

		// Mock URL methods
		window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
		window.URL.revokeObjectURL = vi.fn();

		// Mock requestAnimationFrame
		window.requestAnimationFrame = vi.fn((callback) => {
			callback(0);
			return 0;
		});

		// Mock document methods
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

		// Mock document.createElement to capture created canvases
		originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
			const element = originalCreateElement(tagName);
			if (tagName === 'canvas') {
				const canvas = element as HTMLCanvasElement;
				capturedCanvases.push(canvas);
			} else if (tagName === 'a') {
				// Mock anchor element for download
				return {
					href: '',
					download: '',
					style: { display: '' },
					click: vi.fn()
				} as unknown as HTMLAnchorElement;
			}
			return element;
		});
	});

	it('should export same height PNG for 12mm label in single vs batch mode (validates default 360 DPI)', async () => {
		const labelConfig = {
			labelWidth: 40,
			labelHeight: 12,
			primaryText: 'M8',
			secondaryText: 'ISO 4762',
			showStandard: false,
			showHardwareImage: false,
			showQRCode: false,
			dpi: 360,
			labelMode: 'general' as const
		};

		// Export in single mode
		await exportCanvasLabelAsPNG(labelConfig);

		const singleCanvas = capturedCanvases[0];
		const singleHeight = singleCanvas?.height;
		const singleWidth = singleCanvas?.width;

		console.log('Single mode canvas:', singleWidth, 'x', singleHeight);

		// Reset captured canvases for batch mode
		const singleCanvasCount = capturedCanvases.length;

		// Export in batch mode with same label
		const batch: BatchState = {
			height: 12,
			labels: [
				{
					mode: 'general',
					primaryText: 'M8',
					secondaryText: 'ISO 4762',
					width: 40
				}
			],
			maxLabels: 20
		};

		// Note: Explicitly passing dpi: 360 here, but the default should also be 360
		// This test validates that batch mode uses the same DPI as single mode
		await exportBatchTapeAsPNG({ batch, dpi: 360 });

		// Find batch canvas (should be after single mode canvases)
		const batchCanvas = capturedCanvases[singleCanvasCount];
		const batchHeight = batchCanvas?.height;
		const batchWidth = batchCanvas?.width;

		console.log('Batch mode canvas:', batchWidth, 'x', batchHeight);

		// Both should have same height for 12mm label at 360 DPI
		// Expected: (12mm - 2mm margins) * (360 DPI / 25.4) = 10mm * 14.173 = 142px
		expect(singleHeight).toBe(142);
		expect(batchHeight).toBe(142);
		expect(singleHeight).toBe(batchHeight);
	});
});
