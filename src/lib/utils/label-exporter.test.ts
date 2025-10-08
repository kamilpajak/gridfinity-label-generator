import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportCanvasLabelAsPNG } from './label-exporter';
import * as labelRenderer from './label-renderer';

// Mock label-renderer module
vi.mock('./label-renderer', () => ({
	renderLabelToCanvas: vi.fn()
}));

// Mock label-constraint-solver
vi.mock('./label-constraint-solver', () => ({
	solveLabelLayout: vi.fn(() => ({
		primaryText: { x: 0, y: 5 },
		secondaryText: { x: 0, y: 8 },
		hardwareImage: undefined,
		qrCode: undefined,
		primaryFontSize: 3,
		secondaryFontSize: 2,
		textClipWidth: 20
	}))
}));

// Mock layout-metrics conditionally:
// - In browser environment (jsdom): use real implementation for full integration testing
// - In server environment: use mock to avoid canvas API dependencies
vi.mock('./layout-metrics', async () => {
	// Check if we're in a browser-like environment
	const hasCanvasAPI = typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';

	if (hasCanvasAPI) {
		// Use real implementation in browser environment
		return await vi.importActual('./layout-metrics');
	}

	// Use mock in server environment (no canvas API available)
	return {
		enrichWithCoverageMetrics: vi.fn((layout) =>
			Promise.resolve({
				...layout,
				metadata: {
					coveragePercentage: 50,
					breakdown: {
						primaryText: 20,
						secondaryText: 15,
						image: 10,
						qrCode: 5
					},
					printableArea: 100,
					occupiedArea: 50,
					whitespace: 50
				}
			})
		)
	};
});

describe('label-exporter', () => {
	let mockCanvas: Partial<HTMLCanvasElement> & { toBlob: ReturnType<typeof vi.fn> };
	let mockContext: Partial<CanvasRenderingContext2D>;
	let mockBlob: Blob;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let createObjectURLSpy: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let revokeObjectURLSpy: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let requestAnimationFrameSpy: any;
	let mockAnchor: Partial<HTMLAnchorElement> & { click: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		// Mock global document if not available
		if (typeof document === 'undefined') {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const globalAny = global as any;
			globalAny.document = {
				createElement: vi.fn(),
				body: {
					appendChild: vi.fn(),
					removeChild: vi.fn()
				} as unknown as HTMLBodyElement,
				fonts: {
					load: vi.fn(() => Promise.resolve())
				} as unknown as FontFaceSet
			} as Partial<Document>;
		}

		// Mock global URL if not available
		if (typeof URL === 'undefined') {
			const globalAny = global as typeof global & { URL: typeof URL };
			globalAny.URL = {
				createObjectURL: vi.fn(),
				revokeObjectURL: vi.fn()
			} as unknown as typeof URL;
		}

		// Mock requestAnimationFrame if not available
		if (typeof requestAnimationFrame === 'undefined') {
			const globalAny = global as typeof global & {
				requestAnimationFrame: typeof requestAnimationFrame;
			};
			globalAny.requestAnimationFrame = vi.fn((callback) => {
				callback(0);
				return 0;
			});
		}
		// Mock canvas context
		mockContext = {
			save: vi.fn(),
			restore: vi.fn(),
			clearRect: vi.fn(),
			fillRect: vi.fn()
		};

		// Mock canvas
		mockCanvas = {
			width: 0,
			height: 0,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			getContext: vi.fn(() => mockContext) as any,
			toBlob: vi.fn((callback) => {
				mockBlob = new Blob(['mock-png-data'], { type: 'image/png' });
				callback(mockBlob);
			})
		};

		// Mock anchor element
		mockAnchor = {
			href: '',
			download: '',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			style: { display: '' } as any,
			click: vi.fn()
		};

		// Mock document methods
		const globalAny = global as typeof global & {
			document?: Document;
			URL?: typeof URL;
			requestAnimationFrame?: typeof requestAnimationFrame;
		};
		const doc = globalAny.document || document;
		vi.spyOn(doc, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
			if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
			return {} as unknown as HTMLElement;
		});

		// Mock document.body methods
		doc.body.appendChild = vi.fn();
		doc.body.removeChild = vi.fn();

		// Mock URL methods
		const urlObj = globalAny.URL || URL;
		createObjectURLSpy = vi.spyOn(urlObj, 'createObjectURL').mockReturnValue('blob:mock-url');
		revokeObjectURLSpy = vi.spyOn(urlObj, 'revokeObjectURL');

		// Mock requestAnimationFrame
		if (
			typeof globalAny.requestAnimationFrame !== 'undefined' ||
			typeof window?.requestAnimationFrame !== 'undefined'
		) {
			requestAnimationFrameSpy = vi
				.spyOn(globalAny, 'requestAnimationFrame')
				.mockImplementation((callback) => {
					callback(0);
					return 0;
				});
		}

		// Clear all mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('canvas dimensions for printable area', () => {
		it('should create canvas with printable area dimensions for 12mm label', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 35,
				labelHeight: 12,
				primaryText: 'Test',
				secondaryText: '',
				showStandard: false,
				showHardwareImage: false,
				showQRCode: false
			});

			// Default margins: left: 2, right: 2, top: 1, bottom: 1
			// Printable width: 35 - 2 - 2 = 31mm
			// Printable height: 12 - 1 - 1 = 10mm
			// Scale: 360 / 25.4 ≈ 14.173
			expect(mockCanvas.width).toBe(Math.round(31 * (360 / 25.4)));
			expect(mockCanvas.height).toBe(Math.round(10 * (360 / 25.4)));
		});

		it('should create canvas with printable area dimensions for 9mm label', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 50,
				labelHeight: 9,
				primaryText: 'Test',
				secondaryText: '',
				showStandard: false,
				showHardwareImage: false,
				showQRCode: false
			});

			// Printable width: 50 - 2 - 2 = 46mm
			// Printable height: 9 - 1 - 1 = 7mm
			expect(mockCanvas.width).toBe(Math.round(46 * (360 / 25.4)));
			expect(mockCanvas.height).toBe(Math.round(7 * (360 / 25.4)));
		});

		it('should handle custom margins correctly', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 40,
				labelHeight: 12,
				primaryText: 'Test',
				secondaryText: '',
				showStandard: false,
				showHardwareImage: false,
				showQRCode: false,
				margins: { left: 3, right: 3, top: 2, bottom: 2 }
			});

			// Printable width: 40 - 3 - 3 = 34mm
			// Printable height: 12 - 2 - 2 = 8mm
			expect(mockCanvas.width).toBe(Math.round(34 * (360 / 25.4)));
			expect(mockCanvas.height).toBe(Math.round(8 * (360 / 25.4)));
		});
	});

	describe('DPI scaling', () => {
		it('should scale canvas dimensions based on custom DPI', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 35,
				labelHeight: 12,
				primaryText: 'Test',
				secondaryText: '',
				showStandard: false,
				showHardwareImage: false,
				showQRCode: false,
				dpi: 300 // Custom DPI
			});

			// Printable: 31mm x 10mm
			// Scale: 300 / 25.4 ≈ 11.811
			expect(mockCanvas.width).toBe(Math.round(31 * (300 / 25.4)));
			expect(mockCanvas.height).toBe(Math.round(10 * (300 / 25.4)));
		});

		it('should use default DPI of 360 when not specified', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 35,
				labelHeight: 12,
				primaryText: 'Test',
				secondaryText: '',
				showStandard: false,
				showHardwareImage: false,
				showQRCode: false
			});

			expect(mockCanvas.width).toBe(Math.round(31 * (360 / 25.4)));
			expect(mockCanvas.height).toBe(Math.round(10 * (360 / 25.4)));
		});
	});

	describe('render without margins', () => {
		it('should call renderLabelToCanvas with showMargins: false', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 35,
				labelHeight: 12,
				primaryText: 'Test',
				secondaryText: 'Secondary',
				showStandard: true,
				showHardwareImage: true,
				showQRCode: false
			});

			expect(labelRenderer.renderLabelToCanvas).toHaveBeenCalledWith(
				expect.objectContaining({
					canvas: mockCanvas,
					showMargins: false
				})
			);
		});

		it('should pass correct dimensions to renderLabelToCanvas', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 35,
				labelHeight: 12,
				primaryText: 'Test',
				secondaryText: '',
				showStandard: false,
				showHardwareImage: false,
				showQRCode: false
			});

			expect(labelRenderer.renderLabelToCanvas).toHaveBeenCalledWith(
				expect.objectContaining({
					dimensions: {
						width: 35,
						height: 12,
						printableWidth: 31,
						printableHeight: 10
					}
				})
			);
		});
	});

	describe('download functionality', () => {
		it('should create and click download link', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 35,
				labelHeight: 12,
				primaryText: 'Test',
				secondaryText: '',
				showStandard: false,
				showHardwareImage: false,
				showQRCode: false
			});

			// Check canvas.toBlob was called
			expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');

			// Check blob URL was created
			expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);

			// Check anchor element was configured
			expect(mockAnchor.href).toBe('blob:mock-url');
			expect(mockAnchor.download).toBe('label_31x10mm.png');
			expect(mockAnchor.style?.display).toBe('none');

			// Check anchor was added to DOM, clicked, and removed
			const globalAny = global as typeof global & { document?: Document };
			const doc = globalAny.document || document;
			expect(doc.body.appendChild).toHaveBeenCalledWith(mockAnchor);
			expect(mockAnchor.click).toHaveBeenCalled();
			expect(doc.body.removeChild).toHaveBeenCalledWith(mockAnchor);

			// Check blob URL was revoked
			expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

			// Check requestAnimationFrame was used
			expect(requestAnimationFrameSpy).toHaveBeenCalled();
		});

		it('should generate correct filename based on printable dimensions', async () => {
			await exportCanvasLabelAsPNG({
				labelWidth: 50,
				labelHeight: 9,
				primaryText: 'Test',
				secondaryText: '',
				showStandard: false,
				showHardwareImage: false,
				showQRCode: false
			});

			// Printable: 46mm x 7mm
			expect(mockAnchor.download).toBe('label_46x7mm.png');
		});
	});

	describe('error handling', () => {
		it('should handle renderLabelToCanvas errors', async () => {
			const renderError = new Error('Render failed');
			vi.mocked(labelRenderer.renderLabelToCanvas).mockRejectedValueOnce(renderError);

			// Console.error should be called
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(
				exportCanvasLabelAsPNG({
					labelWidth: 35,
					labelHeight: 12,
					primaryText: 'Test',
					secondaryText: '',
					showStandard: false,
					showHardwareImage: false,
					showQRCode: false
				})
			).rejects.toThrow('Render failed');

			expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to render canvas:', renderError);
			consoleErrorSpy.mockRestore();
		});

		it('should handle blob creation failure', async () => {
			mockCanvas.toBlob = vi.fn((callback) => {
				callback(null); // Blob creation failed
			});

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(
				exportCanvasLabelAsPNG({
					labelWidth: 35,
					labelHeight: 12,
					primaryText: 'Test',
					secondaryText: '',
					showStandard: false,
					showHardwareImage: false,
					showQRCode: false
				})
			).rejects.toThrow('Failed to create PNG blob');

			expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create PNG blob');
			consoleErrorSpy.mockRestore();
		});
	});

	describe('content parameters', () => {
		it('should pass all content parameters to renderLabelToCanvas', async () => {
			const standard = {
				id: 'hex',
				image: '/images/hex.svg',
				description: 'Hex nut',
				designations: [],
				primarySystem: 'ISO' as const
			};

			await exportCanvasLabelAsPNG({
				labelWidth: 35,
				labelHeight: 12,
				primaryText: 'M6',
				secondaryText: 'ISO 4032',
				standard,
				showStandard: true,
				showHardwareImage: true,
				showQRCode: true,
				qrCodeUrl: 'https://example.com'
			});

			expect(labelRenderer.renderLabelToCanvas).toHaveBeenCalledWith(
				expect.objectContaining({
					content: {
						primaryText: 'M6',
						secondaryText: 'ISO 4032',
						standard,
						showStandard: true,
						showHardwareImage: true,
						showQRCode: true,
						qrCodeUrl: 'https://example.com'
					}
				})
			);
		});
	});

	describe('layout-metrics integration', () => {
		it('should enrich layout with coverage metrics', async () => {
			// This test verifies that enrichWithCoverageMetrics is called
			// In server environment: uses mock (returns predefined metadata)
			// In browser environment: uses real implementation (calculates actual coverage)

			await exportCanvasLabelAsPNG({
				labelWidth: 35,
				labelHeight: 12,
				primaryText: 'M6',
				secondaryText: 'ISO 4032',
				showStandard: true,
				showHardwareImage: true,
				showQRCode: false
			});

			// Verify that renderLabelToCanvas was called with layout that has metadata
			expect(labelRenderer.renderLabelToCanvas).toHaveBeenCalledWith(
				expect.objectContaining({
					layout: expect.objectContaining({
						metadata: expect.objectContaining({
							coveragePercentage: expect.any(Number),
							breakdown: expect.objectContaining({
								primaryText: expect.any(Number),
								secondaryText: expect.any(Number),
								image: expect.any(Number),
								qrCode: expect.any(Number)
							}),
							printableArea: expect.any(Number),
							occupiedArea: expect.any(Number),
							whitespace: expect.any(Number)
						})
					})
				})
			);

			// In server environment, mock returns specific values
			// In browser environment, real calculation may differ
			const call = (labelRenderer.renderLabelToCanvas as ReturnType<typeof vi.fn>).mock.calls[0][0];
			expect(call.layout.metadata.coveragePercentage).toBeGreaterThanOrEqual(0);
			expect(call.layout.metadata.coveragePercentage).toBeLessThanOrEqual(100);
		});
	});
});
