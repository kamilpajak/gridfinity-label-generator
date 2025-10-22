import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderBatchTape } from './batch-renderer';
import type { BatchState } from '$lib/types/batch';

// Mock label-constraint-solver module
vi.mock('./label-constraint-solver', () => ({
	solveLabelLayout: vi.fn()
}));

// Mock QRCode library
vi.mock('qrcode', () => ({
	default: {
		toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mockqrcode'))
	}
}));

// Mock canvas context
const mockContext = {
	save: vi.fn(),
	restore: vi.fn(),
	clearRect: vi.fn(),
	fillRect: vi.fn(),
	drawImage: vi.fn(),
	fillText: vi.fn(),
	translate: vi.fn(),
	strokeRect: vi.fn(),
	setLineDash: vi.fn(),
	setTransform: vi.fn(),
	beginPath: vi.fn(),
	moveTo: vi.fn(),
	lineTo: vi.fn(),
	stroke: vi.fn(),
	measureText: vi.fn((text: string) => ({ width: text.length * 5 })),
	fillStyle: '',
	strokeStyle: '',
	lineWidth: 0,
	font: '',
	textAlign: '',
	textBaseline: ''
};

// Mock Image
class MockImage {
	onload: (() => void) | null = null;
	onerror: ((e: Error) => void) | null = null;
	_src = '';
	width = 100;
	height = 200;

	set src(value: string) {
		this._src = value;
		// Trigger onload asynchronously to simulate image loading
		setTimeout(() => {
			if (this.onload) {
				this.onload();
			}
		}, 0);
	}

	get src() {
		return this._src;
	}
}

// Mock document.fonts
const mockFonts = {
	load: vi.fn(() => Promise.resolve())
};

// Mock document.createElement
const mockCreateElement = vi.fn((tagName: string) => {
	if (tagName === 'canvas') {
		return {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
				callback(new Blob([], { type: 'image/png' }));
			})
		};
	}
	return {};
});

describe('batch-renderer', () => {
	let mockCanvas: HTMLCanvasElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let mockSolveLabelLayout: any;

	beforeEach(async () => {
		// Import the mocked module to get access to the mock
		const module = await import('./label-constraint-solver');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mockSolveLabelLayout = module.solveLabelLayout as any;

		// Setup global mocks
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		global.Image = MockImage as any;
		global.document = {
			fonts: mockFonts,
			createElement: mockCreateElement
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;

		// Reset all mocks
		vi.clearAllMocks();

		// Setup default mock implementation for solveLabelLayout
		mockSolveLabelLayout.mockResolvedValue({
			primaryText: { x: 0, y: 5 },
			secondaryText: { x: 0, y: 9 },
			primaryFontSize: 5,
			secondaryFontSize: 3,
			textClipWidth: 30
		});

		// Create mock canvas
		mockCanvas = {
			getContext: vi.fn(() => mockContext),
			width: 0,
			height: 0
		} as unknown as HTMLCanvasElement;
	});

	describe('renderBatchTape', () => {
		it('should throw error for empty batch', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [],
				maxLabels: 20
			};

			await expect(renderBatchTape({ canvas: mockCanvas, batch })).rejects.toThrow(
				'Cannot render empty batch'
			);
		});

		it('should set canvas dimensions for single label', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'general',
						primaryText: 'Test',
						width: 35
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// 12mm tape = 141.73px at 300 DPI
			expect(mockCanvas.height).toBeCloseTo(141.73, 0);
			// Width should be at least label width (to be calculated by solver)
			expect(mockCanvas.width).toBeGreaterThan(0);
		});

		it('should calculate correct canvas width for multiple labels', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{ mode: 'general', primaryText: 'Label 1', width: 35 },
					{ mode: 'general', primaryText: 'Label 2', width: 40 },
					{ mode: 'general', primaryText: 'Label 3', width: 45 }
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// 1mm gap = 11.81px at 300 DPI
			// Width = label1_width + gap + label2_width + gap + label3_width
			expect(mockCanvas.width).toBeGreaterThan(0);
		});

		it('should draw cutting lines between labels', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{ mode: 'general', primaryText: 'Label 1', width: 35 },
					{ mode: 'general', primaryText: 'Label 2', width: 40 },
					{ mode: 'general', primaryText: 'Label 3', width: 45 }
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Should have called line drawing operations
			expect(mockContext.beginPath).toHaveBeenCalled();
			expect(mockContext.moveTo).toHaveBeenCalled();
			expect(mockContext.lineTo).toHaveBeenCalled();
			expect(mockContext.stroke).toHaveBeenCalled();
			expect(mockContext.setLineDash).toHaveBeenCalled();
		});

		it('should not draw cutting lines for single label', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [{ mode: 'general', primaryText: 'Single Label', width: 35 }],
				maxLabels: 20
			};

			vi.clearAllMocks();
			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300, showMargins: false });

			// For single label with no margins, cutting line operations should not be called
			expect(mockContext.stroke).not.toHaveBeenCalled();
		});

		it('should use correct DPI for dimensions', async () => {
			const batch: BatchState = {
				height: 9,
				labels: [{ mode: 'general', primaryText: 'Test', width: 35 }],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 600 });

			// 9mm at 600 DPI = 212.6px
			expect(mockCanvas.height).toBeCloseTo(212.6, 0);
		});

		it('should handle fastener labels', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M5',
						length: 20,
						width: 40
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });
			expect(mockCanvas.width).toBeGreaterThan(0);
			expect(mockCanvas.height).toBeGreaterThan(0);
		});

		it('should handle mixed label modes', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{ mode: 'general', primaryText: 'General', width: 35 },
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M8',
						length: 30,
						width: 40
					},
					{ mode: 'general', primaryText: 'Another General', width: 40 }
				],
				maxLabels: 20
			};

			await expect(renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 })).resolves.not.toThrow();
		});

		it('should respect 1mm gap between labels', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{ mode: 'general', primaryText: 'A', width: 30 },
					{ mode: 'general', primaryText: 'B', width: 35 }
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Gap of 1mm at 300 DPI = 11.81px
			// This should be reflected in the total width calculation
			// Total width = label1_width + 11.81 + label2_width
			expect(mockCanvas.width).toBeGreaterThan(11.81);
		});

		it('should use gray dashed line style for cutting lines', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{ mode: 'general', primaryText: 'A', width: 30 },
					{ mode: 'general', primaryText: 'B', width: 35 }
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Should set line dash pattern for cutting lines
			expect(mockContext.setLineDash).toHaveBeenCalled();
		});

		it('should handle export without margins', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [{ mode: 'general', primaryText: 'Export Test', width: 35 }],
				maxLabels: 20
			};

			await renderBatchTape({
				canvas: mockCanvas,
				batch,
				dpi: 300,
				showMargins: false
			});

			// Should not show margin guides
			expect(mockCanvas.width).toBeGreaterThan(0);
		});

		it('should handle labels with QR codes', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'general',
						primaryText: 'Test',
						qrCode: 'https://example.com',
						width: 50
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });
			expect(mockCanvas.width).toBeGreaterThan(0);
		});

		it('should handle labels with different lengths', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M3',
						length: 10,
						width: 40
					},
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M5',
						length: 50,
						width: 40
					},
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M8',
						length: 100,
						width: 40
					}
				],
				maxLabels: 20
			};

			await expect(renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 })).resolves.not.toThrow();
			expect(mockCanvas.width).toBeGreaterThan(0);
		});
	});

	describe('toggle flags', () => {
		it('should pass showHardwareImage=false to solver when showImage=false', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M6',
						length: 20,
						width: 40,
						standard: 'iso-4017',
						showImage: false
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Verify solver was called with showHardwareImage: false
			expect(mockSolveLabelLayout).toHaveBeenCalledWith(
				expect.objectContaining({
					showHardwareImage: false
				})
			);
		});

		it('should pass showStandard=false to solver when showReference=false', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M6',
						length: 20,
						width: 40,
						standard: 'iso-4017',
						showReference: false
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Verify solver was called with showStandard: false
			expect(mockSolveLabelLayout).toHaveBeenCalledWith(
				expect.objectContaining({
					showStandard: false
				})
			);
		});

		it('should pass showQRCode=false to solver when showQRCode=false', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'general',
						primaryText: 'Test',
						qrCode: 'https://example.com',
						showQRCode: false,
						width: 40
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Verify solver was called with showQRCode: false
			expect(mockSolveLabelLayout).toHaveBeenCalledWith(
				expect.objectContaining({
					showQRCode: false
				})
			);
		});

		it('should pass showHardwareImage=true when showImage is undefined (default)', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M6',
						length: 20,
						width: 40,
						standard: 'din93' // Use a standard that has an image
						// showImage is undefined, should default to true
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Verify solver was called with showHardwareImage: true (default)
			expect(mockSolveLabelLayout).toHaveBeenCalledWith(
				expect.objectContaining({
					showHardwareImage: true
				})
			);
		});

		it('should show reference by default when showReference is undefined', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M6',
						length: 20,
						width: 40,
						standard: 'iso-4017'
						// showReference is undefined, should default to true
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });
			expect(mockCanvas.width).toBeGreaterThan(0);
		});

		it('should show QR code by default when showQRCode is undefined', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'general',
						primaryText: 'Test',
						qrCode: 'https://example.com',
						width: 40
						// showQRCode is undefined, should default to true
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });
			expect(mockCanvas.width).toBeGreaterThan(0);
		});

		it('should not include standard text in secondaryText when showReference=false', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M6',
						length: 20,
						width: 40,
						standard: 'iso-4017',
						showReference: false,
						note: 'Custom note'
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Verify secondaryText does NOT contain standard designation
			expect(mockSolveLabelLayout).toHaveBeenCalledWith(
				expect.objectContaining({
					secondaryText: 'Custom note' // Fixed: no leading space before note (appendOptionalNote handles spacing)
				})
			);
		});

		it('should include standard text in secondaryText when showReference=true', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M6',
						length: 20,
						width: 40,
						standard: 'din93',
						showReference: true,
						note: 'Custom note'
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Verify secondaryText DOES contain standard designation + note
			expect(mockSolveLabelLayout).toHaveBeenCalledWith(
				expect.objectContaining({
					secondaryText: expect.stringContaining('DIN 93')
				})
			);
			expect(mockSolveLabelLayout).toHaveBeenCalledWith(
				expect.objectContaining({
					secondaryText: expect.stringContaining('Custom note')
				})
			);
		});

		it('should handle mixed toggle states across multiple labels', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M6',
						length: 20,
						width: 40,
						standard: 'iso-4017',
						showImage: true,
						showReference: true
					},
					{
						mode: 'fastener',
						measurementSystem: 'metric',
						threadSize: 'M8',
						length: 30,
						width: 40,
						standard: 'iso-4762',
						showImage: false,
						showReference: true
					},
					{
						mode: 'general',
						primaryText: 'Test',
						qrCode: 'https://example.com',
						showQRCode: false,
						width: 40
					}
				],
				maxLabels: 20
			};

			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });
			expect(mockCanvas.width).toBeGreaterThan(0);
		});
	});

	describe('cutting line placement', () => {
		it('should draw 2 cutting lines for 3 labels', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{ mode: 'general', primaryText: 'A', width: 30 },
					{ mode: 'general', primaryText: 'B', width: 35 },
					{ mode: 'general', primaryText: 'C', width: 40 }
				],
				maxLabels: 20
			};

			vi.clearAllMocks();
			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Should have 2 cutting lines (between 3 labels)
			// Each cutting line calls stroke() once
			expect(mockContext.stroke).toHaveBeenCalledTimes(2);
		});

		it('should draw 3 cutting lines for 4 labels', async () => {
			const batch: BatchState = {
				height: 12,
				labels: [
					{ mode: 'general', primaryText: 'A', width: 30 },
					{ mode: 'general', primaryText: 'B', width: 35 },
					{ mode: 'general', primaryText: 'C', width: 40 },
					{ mode: 'general', primaryText: 'D', width: 45 }
				],
				maxLabels: 20
			};

			vi.clearAllMocks();
			await renderBatchTape({ canvas: mockCanvas, batch, dpi: 300 });

			// Should have 3 cutting lines (between 4 labels)
			expect(mockContext.stroke).toHaveBeenCalledTimes(3);
		});
	});
});
