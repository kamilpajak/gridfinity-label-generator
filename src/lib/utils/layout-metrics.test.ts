import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateCoverageMetrics, enrichWithCoverageMetrics } from './layout-metrics';
import type { SolverOutput, LabelDimensions } from './label-constraint-solver';

// Mock document.fonts
const mockFonts = {
	load: vi.fn(() => Promise.resolve())
};

// Mock canvas for text measurement
const mockContext = {
	measureText: vi.fn((text: string) => ({
		width: text.length * 2 // Simple mock: 2mm per character
	})),
	font: ''
};

const mockCanvas = {
	getContext: vi.fn(() => mockContext)
};

describe('layout-metrics', () => {
	beforeEach(() => {
		global.document = {
			fonts: mockFonts,
			createElement: vi.fn(() => mockCanvas)
		} as unknown as Document;
		vi.clearAllMocks();
	});

	describe('calculateCoverageMetrics', () => {
		const dimensions: LabelDimensions = {
			width: 35,
			height: 12,
			printableWidth: 31,
			printableHeight: 10
		};

		const baseLayout: SolverOutput = {
			primaryText: { x: 10, y: 5 },
			secondaryText: { x: 10, y: 8 },
			primaryFontSize: 3,
			secondaryFontSize: 2,
			hardwareImage: { x: 1, y: 2, width: 6, height: 6 },
			qrCode: { x: 22, y: 0, width: 10, height: 10 },
			textClipWidth: 20
		};

		it('should calculate coverage percentage correctly', async () => {
			const metrics = await calculateCoverageMetrics(baseLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: true
			});

			expect(metrics.coveragePercentage).toBeGreaterThan(0);
			expect(metrics.coveragePercentage).toBeLessThanOrEqual(100);
			expect(metrics.printableArea).toBe(310); // 31 * 10
			expect(metrics.occupiedArea).toBeLessThanOrEqual(310);
			expect(metrics.whitespace).toBeGreaterThanOrEqual(0);
			expect(metrics.occupiedArea + metrics.whitespace).toBeCloseTo(metrics.printableArea, 0.1);
		});

		it('should break down coverage by element type', async () => {
			const metrics = await calculateCoverageMetrics(baseLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: true
			});

			expect(metrics.breakdown.primaryText).toBeGreaterThan(0);
			expect(metrics.breakdown.secondaryText).toBeGreaterThan(0);
			expect(metrics.breakdown.image).toBe(36); // 6 * 6
			expect(metrics.breakdown.qrCode).toBe(100); // 10 * 10

			const total =
				metrics.breakdown.primaryText +
				metrics.breakdown.secondaryText +
				metrics.breakdown.image +
				metrics.breakdown.qrCode;
			expect(total).toBeCloseTo(metrics.occupiedArea, 0.1);
		});

		it('should handle layouts without hardware image', async () => {
			const layoutWithoutImage = { ...baseLayout, hardwareImage: undefined };

			const metrics = await calculateCoverageMetrics(layoutWithoutImage, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: false,
				showQRCode: true
			});

			expect(metrics.breakdown.image).toBe(0);
			expect(metrics.breakdown.primaryText).toBeGreaterThan(0);
			expect(metrics.breakdown.secondaryText).toBeGreaterThan(0);
			expect(metrics.breakdown.qrCode).toBe(100);
		});

		it('should handle layouts without QR code', async () => {
			const layoutWithoutQR = { ...baseLayout, qrCode: undefined };

			const metrics = await calculateCoverageMetrics(layoutWithoutQR, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: false
			});

			expect(metrics.breakdown.qrCode).toBe(0);
			expect(metrics.breakdown.primaryText).toBeGreaterThan(0);
			expect(metrics.breakdown.secondaryText).toBeGreaterThan(0);
			expect(metrics.breakdown.image).toBe(36);
		});

		it('should handle minimal layout (text only)', async () => {
			const minimalLayout: SolverOutput = {
				primaryText: { x: 0, y: 5 },
				secondaryText: { x: 0, y: 8 },
				primaryFontSize: 3,
				secondaryFontSize: 2,
				textClipWidth: 31
			};

			const metrics = await calculateCoverageMetrics(minimalLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: false,
				showQRCode: false
			});

			expect(metrics.breakdown.image).toBe(0);
			expect(metrics.breakdown.qrCode).toBe(0);
			expect(metrics.breakdown.primaryText).toBeGreaterThan(0);
			expect(metrics.breakdown.secondaryText).toBeGreaterThan(0);
			expect(metrics.occupiedArea).toBe(
				metrics.breakdown.primaryText + metrics.breakdown.secondaryText
			);
		});

		it('should use line height factor for text height calculation', async () => {
			const metrics = await calculateCoverageMetrics(baseLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: true
			});

			// Primary text: "M8" = 2 chars * 2mm = 4mm width
			// Height = fontSize * 1.2 = 3 * 1.2 = 3.6mm
			// Area = 4 * 3.6 = 14.4mm²
			expect(metrics.breakdown.primaryText).toBeCloseTo(14.4, 0.1);

			// Secondary text: "ISO 4762" = 8 chars * 2mm = 16mm width
			// Height = fontSize * 1.2 = 2 * 1.2 = 2.4mm
			// Area = 16 * 2.4 = 38.4mm²
			expect(metrics.breakdown.secondaryText).toBeCloseTo(38.4, 0.1);
		});

		it('should handle ONE_LINE mode with combined text', async () => {
			const oneLineLayout: SolverOutput = {
				primaryText: { x: 10, y: 5 },
				secondaryText: { x: -1000, y: -1000 },
				primaryFontSize: 3,
				secondaryFontSize: 3,
				hardwareImage: { x: 1, y: 2, width: 6, height: 6 },
				qrCode: { x: 22, y: 0, width: 10, height: 10 },
				textClipWidth: 20,
				layoutMode: 'ONE_LINE'
			};

			const metrics = await calculateCoverageMetrics(oneLineLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: true
			});

			// Combined text: "M8 ISO 4762" = 11 chars * 2mm = 22mm width
			// Height = fontSize * 1.2 = 3 * 1.2 = 3.6mm
			// Area = 22 * 3.6 = 79.2mm²
			expect(metrics.breakdown.primaryText).toBeCloseTo(79.2, 0.1);

			// Secondary text area should be 0 in ONE_LINE mode
			expect(metrics.breakdown.secondaryText).toBe(0);

			// Image and QR code unchanged
			expect(metrics.breakdown.image).toBe(36);
			expect(metrics.breakdown.qrCode).toBe(100);
		});

		it('should handle ONE_LINE mode without secondary text', async () => {
			const oneLineLayout: SolverOutput = {
				primaryText: { x: 10, y: 5 },
				secondaryText: { x: -1000, y: -1000 },
				primaryFontSize: 3,
				secondaryFontSize: 3,
				textClipWidth: 20,
				layoutMode: 'ONE_LINE'
			};

			const metrics = await calculateCoverageMetrics(oneLineLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: '',
				showHardwareImage: false,
				showQRCode: false
			});

			// Only primary text: "M8" = 2 chars * 2mm = 4mm width
			// Height = fontSize * 1.2 = 3 * 1.2 = 3.6mm
			// Area = 4 * 3.6 = 14.4mm²
			expect(metrics.breakdown.primaryText).toBeCloseTo(14.4, 0.1);

			// Secondary text area should be 0
			expect(metrics.breakdown.secondaryText).toBe(0);

			// No other elements
			expect(metrics.breakdown.image).toBe(0);
			expect(metrics.breakdown.qrCode).toBe(0);

			expect(metrics.occupiedArea).toBeCloseTo(14.4, 0.1);
		});

		it('should handle TWO_LINE mode explicitly', async () => {
			const twoLineLayout: SolverOutput = {
				...baseLayout,
				layoutMode: 'TWO_LINE'
			};

			const metrics = await calculateCoverageMetrics(twoLineLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: true
			});

			// Should measure texts separately in TWO_LINE mode
			expect(metrics.breakdown.primaryText).toBeCloseTo(14.4, 0.1);
			expect(metrics.breakdown.secondaryText).toBeCloseTo(38.4, 0.1);
			expect(metrics.breakdown.image).toBe(36);
			expect(metrics.breakdown.qrCode).toBe(100);
		});
	});

	describe('enrichWithCoverageMetrics', () => {
		const dimensions: LabelDimensions = {
			width: 35,
			height: 12,
			printableWidth: 31,
			printableHeight: 10
		};

		const baseLayout: SolverOutput = {
			primaryText: { x: 10, y: 5 },
			secondaryText: { x: 10, y: 8 },
			primaryFontSize: 3,
			secondaryFontSize: 2,
			hardwareImage: { x: 1, y: 2, width: 6, height: 6 },
			qrCode: { x: 22, y: 0, width: 10, height: 10 },
			textClipWidth: 20
		};

		it('should return enriched layout with metadata', async () => {
			const enriched = await enrichWithCoverageMetrics(baseLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: true
			});

			expect(enriched).toHaveProperty('metadata');
			expect(enriched.metadata).toHaveProperty('coveragePercentage');
			expect(enriched.metadata).toHaveProperty('breakdown');
			expect(enriched.metadata).toHaveProperty('printableArea');
			expect(enriched.metadata).toHaveProperty('occupiedArea');
			expect(enriched.metadata).toHaveProperty('whitespace');
		});

		it('should preserve all original layout properties', async () => {
			const enriched = await enrichWithCoverageMetrics(baseLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: true
			});

			expect(enriched.primaryText).toEqual(baseLayout.primaryText);
			expect(enriched.secondaryText).toEqual(baseLayout.secondaryText);
			expect(enriched.primaryFontSize).toBe(baseLayout.primaryFontSize);
			expect(enriched.secondaryFontSize).toBe(baseLayout.secondaryFontSize);
			expect(enriched.hardwareImage).toEqual(baseLayout.hardwareImage);
			expect(enriched.qrCode).toEqual(baseLayout.qrCode);
			expect(enriched.textClipWidth).toBe(baseLayout.textClipWidth);
		});

		it('should log metrics in dev mode', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			await enrichWithCoverageMetrics(baseLayout, dimensions, {
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				showQRCode: true
			});

			// Note: This test will only pass in dev mode (import.meta.env.DEV === true)
			// In test environment, the logging might not occur
			if (import.meta.env.DEV) {
				expect(consoleSpy).toHaveBeenCalledWith(
					'[Coverage Metrics]',
					expect.objectContaining({
						coverage: expect.stringMatching(/^\d+\.\d%$/),
						occupied: expect.stringMatching(/^\d+\.\dmm²$/),
						whitespace: expect.stringMatching(/^\d+\.\dmm²$/),
						breakdown: expect.any(Object)
					})
				);
			}

			consoleSpy.mockRestore();
		});
	});
});
