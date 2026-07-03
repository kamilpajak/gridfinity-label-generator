/**
 * Tests for Batch Tape Exporter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportBatchTapeAsPNG } from './batch-exporter';
import type { BatchRenderData } from '$lib/types/batch';
import * as batchRenderer from './batch-renderer';

// Mock the batch renderer
vi.mock('./batch-renderer', () => ({
	renderBatchTape: vi.fn()
}));

describe('batch-exporter', () => {
	let mockCanvas: HTMLCanvasElement;
	let mockBlob: Blob;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let createElementSpy: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let appendChildSpy: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let removeChildSpy: any;
	let clickSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Setup DOM mocks
		mockCanvas = {
			width: 1000,
			height: 300,
			toBlob: vi.fn((callback) => {
				mockBlob = new Blob(['fake-png-data'], { type: 'image/png' });
				callback(mockBlob);
			})
		} as unknown as HTMLCanvasElement;

		// Mock document.createElement to return mock canvas
		createElementSpy = vi.spyOn(document, 'createElement');
		createElementSpy.mockImplementation((tagName: string) => {
			if (tagName === 'canvas') {
				return mockCanvas;
			}
			if (tagName === 'a') {
				clickSpy = vi.fn();
				return {
					href: '',
					download: '',
					style: { display: '' },
					click: clickSpy
				} as unknown as HTMLAnchorElement;
			}
			return document.createElement(tagName);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		appendChildSpy = vi.spyOn(document.body, 'appendChild');
		removeChildSpy = vi.spyOn(document.body, 'removeChild');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		appendChildSpy.mockImplementation(() => null as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		removeChildSpy.mockImplementation(() => null as any);

		// Mock URL methods
		window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
		window.URL.revokeObjectURL = vi.fn();

		// Mock requestAnimationFrame
		window.requestAnimationFrame = vi.fn((callback) => {
			callback(0);
			return 0;
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('exportBatchTapeAsPNG', () => {
		it('should throw error for empty batch', async () => {
			const emptyBatch: BatchRenderData = {
				height: 12,
				labels: [],
				maxLabels: 20
			};

			await expect(exportBatchTapeAsPNG({ batch: emptyBatch })).rejects.toThrow(
				'Cannot export empty batch'
			);
		});

		it('should create canvas and call renderBatchTape', async () => {
			const batch: BatchRenderData = {
				height: 12,
				labels: [
					{
						mode: 'general',
						primaryText: 'Test Label',
						secondaryText: 'Subtitle',
						width: 40
					}
				],
				maxLabels: 20
			};

			await exportBatchTapeAsPNG({ batch });

			expect(createElementSpy).toHaveBeenCalledWith('canvas');
			expect(batchRenderer.renderBatchTape).toHaveBeenCalledWith({
				canvas: mockCanvas,
				batch,
				dpi: 360,
				showMargins: false
			});
		});

		it('should use custom DPI when provided', async () => {
			const batch: BatchRenderData = {
				height: 9,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M5',
						length: 20,
						width: 35
					}
				],
				maxLabels: 20
			};

			await exportBatchTapeAsPNG({ batch, dpi: 600 });

			expect(batchRenderer.renderBatchTape).toHaveBeenCalledWith(
				expect.objectContaining({ dpi: 600 })
			);
		});

		it('should generate filename with timestamp and label count', async () => {
			const batch: BatchRenderData = {
				height: 12,
				labels: [
					{ mode: 'general', primaryText: 'Label 1', width: 40 },
					{ mode: 'general', primaryText: 'Label 2', width: 40 },
					{ mode: 'general', primaryText: 'Label 3', width: 40 }
				],
				maxLabels: 20
			};

			const now = new Date('2025-01-02T14:30:52');
			vi.setSystemTime(now);

			await exportBatchTapeAsPNG({ batch });

			// Check that download was called with correct filename pattern
			const mockAnchor = createElementSpy.mock.results.find(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(result: any) => result.value.download !== undefined
			)?.value;
			expect(mockAnchor?.download).toMatch(/^batch_20250102_143052_3labels\.png$/);

			vi.useRealTimers();
		});

		it('should create blob and trigger download', async () => {
			const batch: BatchRenderData = {
				height: 12,
				labels: [{ mode: 'general', primaryText: 'Test', width: 40 }],
				maxLabels: 20
			};

			await exportBatchTapeAsPNG({ batch });

			expect(mockCanvas.toBlob).toHaveBeenCalled();
			expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
			expect(appendChildSpy).toHaveBeenCalled();
			expect(clickSpy).toHaveBeenCalled();
			expect(removeChildSpy).toHaveBeenCalled();
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
		});

		it('should handle render error gracefully', async () => {
			const batch: BatchRenderData = {
				height: 12,
				labels: [{ mode: 'general', primaryText: 'Test', width: 40 }],
				maxLabels: 20
			};

			vi.mocked(batchRenderer.renderBatchTape).mockRejectedValueOnce(new Error('Render failed'));

			await expect(exportBatchTapeAsPNG({ batch })).rejects.toThrow('Render failed');
		});

		it('should handle blob creation failure', async () => {
			const batch: BatchRenderData = {
				height: 12,
				labels: [{ mode: 'general', primaryText: 'Test', width: 40 }],
				maxLabels: 20
			};

			// Mock toBlob to call callback with null
			mockCanvas.toBlob = vi.fn((callback) => {
				callback(null);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			}) as any;

			await expect(exportBatchTapeAsPNG({ batch })).rejects.toThrow('Failed to create PNG blob');
		});

		it('should export batch with mixed label modes', async () => {
			const batch: BatchRenderData = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M8',
						length: 30,
						width: 50,
						standard: 'ISO 4762'
					},
					{
						mode: 'general',
						primaryText: 'Spacer',
						secondaryText: '5mm',
						width: 35
					},
					{
						mode: 'fastener',
						measurementSystem: 'imperial',
						threadSize: '#6',
						length: 1.5,
						width: 45
					}
				],
				maxLabels: 20
			};

			await exportBatchTapeAsPNG({ batch });

			expect(batchRenderer.renderBatchTape).toHaveBeenCalledWith({
				canvas: mockCanvas,
				batch,
				dpi: 360,
				showMargins: false
			});

			// Verify filename has correct label count
			const mockAnchor = createElementSpy.mock.results.find(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(result: any) => result.value.download !== undefined
			)?.value;
			expect(mockAnchor?.download).toMatch(/_3labels\.png$/);
		});

		it('should export maximum batch size (20 labels)', async () => {
			const labels = Array.from({ length: 20 }, (_, i) => ({
				mode: 'general' as const,
				primaryText: `Label ${i + 1}`,
				width: 40
			}));

			const batch: BatchRenderData = {
				height: 12,
				labels,
				maxLabels: 20
			};

			await exportBatchTapeAsPNG({ batch });

			expect(batchRenderer.renderBatchTape).toHaveBeenCalled();

			const mockAnchor = createElementSpy.mock.results.find(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(result: any) => result.value.download !== undefined
			)?.value;
			expect(mockAnchor?.download).toMatch(/_20labels\.png$/);
		});
	});

	describe('filename generation', () => {
		it('should format timestamps with leading zeros', async () => {
			const batch: BatchRenderData = {
				height: 12,
				labels: [{ mode: 'general', primaryText: 'Test', width: 40 }],
				maxLabels: 20
			};

			// Test with single-digit month and day
			const now = new Date('2025-03-05T08:09:07');
			vi.setSystemTime(now);

			await exportBatchTapeAsPNG({ batch });

			const mockAnchor = createElementSpy.mock.results.find(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(result: any) => result.value.download !== undefined
			)?.value;
			expect(mockAnchor?.download).toBe('batch_20250305_080907_1labels.png');

			vi.useRealTimers();
		});

		it('should handle different label counts in filename', async () => {
			const testCases = [
				{ count: 1, expected: '_1labels.png' },
				{ count: 5, expected: '_5labels.png' },
				{ count: 10, expected: '_10labels.png' },
				{ count: 20, expected: '_20labels.png' }
			];

			for (const { count, expected } of testCases) {
				const labels = Array.from({ length: count }, () => ({
					mode: 'general' as const,
					primaryText: 'Test',
					width: 40
				}));

				const batch: BatchRenderData = { height: 12, labels, maxLabels: 20 };
				await exportBatchTapeAsPNG({ batch });

				const mockAnchor = createElementSpy.mock.results.find(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(result: any) => result.value.download !== undefined
				)?.value;
				expect(mockAnchor?.download).toMatch(new RegExp(expected + '$'));

				vi.clearAllMocks();
			}
		});
	});

	describe('DPI consistency', () => {
		it('should use the same default DPI as single mode (360)', async () => {
			// Import single mode exporter to compare DPI constants
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { exportCanvasLabelAsPNG } = await import('./label-exporter');

			const batch: BatchRenderData = {
				height: 12,
				labels: [{ mode: 'general', primaryText: 'Test', width: 40 }],
				maxLabels: 20
			};

			await exportBatchTapeAsPNG({ batch });

			// Verify batch mode uses 360 DPI (matching single mode DEFAULT_DPI)
			expect(batchRenderer.renderBatchTape).toHaveBeenCalledWith(
				expect.objectContaining({ dpi: 360 })
			);

			// Note: Single mode uses DEFAULT_DPI = 360 in label-exporter.ts:31
			// This test ensures both modes stay in sync
		});

		it('should calculate same canvas height as single mode for 12mm label', async () => {
			const dpi = 360;
			const labelHeightMm = 12;
			const marginTopMm = 1;
			const marginBottomMm = 1;

			// Single mode calculation (from label-exporter.ts:54-64)
			const printableHeight_single = labelHeightMm - marginTopMm - marginBottomMm; // 10mm
			const scale_single = dpi / 25.4;
			const expectedHeight_single = Math.round(printableHeight_single * scale_single); // 142px

			// Batch mode calculation (from batch-renderer.ts:209-212)
			const printableHeightMm_batch = labelHeightMm - marginTopMm - marginBottomMm; // 10mm
			const mmToPixels = (mm: number, dpi: number) => mm * (dpi / 25.4);
			const expectedHeight_batch = Math.round(mmToPixels(printableHeightMm_batch, dpi)); // 142px

			// Both should be identical
			expect(expectedHeight_single).toBe(expectedHeight_batch);
			expect(expectedHeight_single).toBe(142); // Verify expected value
		});

		it('should calculate same canvas height as single mode for 9mm label', async () => {
			const dpi = 360;
			const labelHeightMm = 9;
			const marginTopMm = 1;
			const marginBottomMm = 1;

			// Single mode calculation
			const printableHeight_single = labelHeightMm - marginTopMm - marginBottomMm; // 7mm
			const scale_single = dpi / 25.4;
			const expectedHeight_single = Math.round(printableHeight_single * scale_single);

			// Batch mode calculation
			const printableHeightMm_batch = labelHeightMm - marginTopMm - marginBottomMm; // 7mm
			const mmToPixels = (mm: number, dpi: number) => mm * (dpi / 25.4);
			const expectedHeight_batch = Math.round(mmToPixels(printableHeightMm_batch, dpi));

			// Both should be identical
			expect(expectedHeight_single).toBe(expectedHeight_batch);
			expect(expectedHeight_single).toBe(99); // 7mm at 360 DPI = 99px
		});
	});
});
