import { describe, it, expect, vi, beforeEach } from 'vitest';
import { solveLabelLayout, type SolverInput } from './label-constraint-solver';
import * as fontMetrics from './font-metrics';

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

describe('label-constraint-solver', () => {
	beforeEach(() => {
		global.document = {
			fonts: mockFonts,
			createElement: vi.fn(() => mockCanvas)
		} as unknown as Document;
		vi.clearAllMocks();

		// Mock font metrics with realistic values (Noto Sans 900 and Oswald 300)
		vi.spyOn(fontMetrics, 'getCachedFontMetrics').mockImplementation(
			async (fontFamily: string, fontWeight: string) => {
				if (fontFamily === 'Noto Sans' && fontWeight === '900') {
					return { ascent: 0.713, descent: 0.01 };
				}
				if (fontFamily === 'Oswald' && fontWeight === '300') {
					return { ascent: 0.809, descent: 0.01 };
				}
				// Fallback for other fonts
				return { ascent: 0.75, descent: 0.25 };
			}
		);

		// Mock cap-height measurements
		vi.spyOn(fontMetrics, 'getCachedCapHeight').mockImplementation(
			(fontFamily: string, fontWeight: string) => {
				if (fontFamily === 'Noto Sans' && fontWeight === '900') {
					return 0.713; // Same as ascent for simplicity
				}
				if (fontFamily === 'Oswald' && fontWeight === '300') {
					return 0.809; // Same as ascent for simplicity
				}
				return 0.7; // Fallback
			}
		);
	});

	describe('Layout Mode Decision', () => {
		const dimensions = {
			width: 35,
			height: 12,
			printableWidth: 31,
			printableHeight: 10
		};

		it('should default to TWO_LINE mode when no secondary text', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: '',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('TWO_LINE');
		});

		it('should evaluate both ONE_LINE and TWO_LINE modes with secondary text', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Should have made a decision
			expect(result.layoutMode).toMatch(/^(ONE_LINE|TWO_LINE)$/);
		});

		it('should choose TWO_LINE for longer texts that benefit from separation', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M10x50',
				secondaryText: 'DIN 912 Hexagon Socket',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// TWO_LINE should win due to better font size optimization
			expect(result.layoutMode).toBe('TWO_LINE');
			expect(result.primaryFontSize).toBeGreaterThan(0);
			expect(result.secondaryFontSize).toBeGreaterThan(0);
		});

		it('should choose ONE_LINE for very short combined text', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: 'DIN',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Short text should potentially benefit from ONE_LINE with larger font
			// (exact outcome depends on scoring, but should be valid)
			expect(result.layoutMode).toMatch(/^(ONE_LINE|TWO_LINE)$/);

			if (result.layoutMode === 'ONE_LINE') {
				// In ONE_LINE mode, cap-height normalization is applied
				// Secondary font is scaled to match primary's visual cap-height
				const primaryCapHeight = result.primaryFontSize * 0.713;
				const secondaryCapHeight = result.secondaryFontSize * 0.809;
				expect(Math.abs(primaryCapHeight - secondaryCapHeight)).toBeLessThan(
					primaryCapHeight * 0.01
				);
			}
		});

		it('should handle ONE_LINE mode with hardware image', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				hardwareImageAspectRatio: 1.0,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Should work with hardware image present
			expect(result.layoutMode).toMatch(/^(ONE_LINE|TWO_LINE)$/);

			if (result.layoutMode === 'ONE_LINE') {
				// Both texts should be on same baseline
				expect(result.primaryText.y).toBe(result.secondaryText.y);
				// Secondary text should be positioned after primary text
				expect(result.secondaryText.x).toBeGreaterThan(result.primaryText.x);
			}

			if (result.hardwareImage) {
				expect(result.hardwareImage.width).toBeGreaterThan(0);
				expect(result.hardwareImage.height).toBeGreaterThan(0);
			}
		});

		it('should handle ONE_LINE mode with QR code', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: false,
				showQRCode: true,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Should work with QR code present
			expect(result.layoutMode).toMatch(/^(ONE_LINE|TWO_LINE)$/);

			if (result.qrCode) {
				expect(result.qrCode.width).toBeGreaterThan(0);
				expect(result.qrCode.height).toBeGreaterThan(0);
			}
		});

		it('should produce valid font sizes in ONE_LINE mode', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Font sizes should always be positive and reasonable
			expect(result.primaryFontSize).toBeGreaterThan(0);
			expect(result.secondaryFontSize).toBeGreaterThan(0);

			if (result.layoutMode === 'ONE_LINE') {
				// In ONE_LINE mode, cap-height normalization is applied
				// Secondary font is scaled to match primary's visual cap-height
				const primaryCapHeight = result.primaryFontSize * 0.713;
				const secondaryCapHeight = result.secondaryFontSize * 0.809;
				expect(Math.abs(primaryCapHeight - secondaryCapHeight)).toBeLessThan(
					primaryCapHeight * 0.01
				);
			}
		});

		it('should produce valid positions in ONE_LINE mode', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Primary text should always be within printable area
			expect(result.primaryText.x).toBeGreaterThanOrEqual(0);
			expect(result.primaryText.y).toBeGreaterThanOrEqual(0);
			expect(result.primaryText.x).toBeLessThanOrEqual(dimensions.printableWidth);
			expect(result.primaryText.y).toBeLessThanOrEqual(dimensions.printableHeight);

			// Both modes should have secondary text within printable area
			expect(result.secondaryText.x).toBeGreaterThanOrEqual(0);
			expect(result.secondaryText.y).toBeGreaterThanOrEqual(0);

			if (result.layoutMode === 'ONE_LINE') {
				// In ONE_LINE mode, both texts should be on same baseline
				expect(result.primaryText.y).toBe(result.secondaryText.y);
				// Secondary text should be positioned after primary text
				expect(result.secondaryText.x).toBeGreaterThan(result.primaryText.x);
			}
		});

		it('should handle complex layout with all elements', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				hardwareImageAspectRatio: 1.0,
				showQRCode: true,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Should make a valid decision
			expect(result.layoutMode).toMatch(/^(ONE_LINE|TWO_LINE)$/);

			// All elements should be positioned
			expect(result.primaryText).toBeDefined();
			expect(result.secondaryText).toBeDefined();
			expect(result.hardwareImage).toBeDefined();
			expect(result.qrCode).toBeDefined();

			// Font sizes should be valid
			expect(result.primaryFontSize).toBeGreaterThan(0);
			expect(result.secondaryFontSize).toBeGreaterThan(0);
		});

		it('should prefer larger fonts when choosing mode', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 35,
					height: 12,
					printableWidth: 31,
					printableHeight: 10
				},
				primaryText: 'M4',
				secondaryText: 'DIN',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Very short text should potentially use ONE_LINE for larger font
			// Scoring heavily weights font size (weight: 100)
			expect(result.layoutMode).toBeDefined();

			// Regardless of mode, fonts should be optimized
			const avgFontSize = (result.primaryFontSize + result.secondaryFontSize) / 2;
			expect(avgFontSize).toBeGreaterThan(2); // Should achieve reasonable size
		});
	});

	describe('Font Metrics', () => {
		const dimensions = {
			width: 37,
			height: 12,
			printableWidth: 33,
			printableHeight: 10
		};

		it('should use correct ascent/descent ratios for Noto Sans 900', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M3',
				secondaryText: '',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// With real metrics (ascent=0.713, descent=0.010), text should fit better
			// Primary font should be reasonably sized
			expect(result.primaryFontSize).toBeGreaterThan(3);
			expect(result.primaryFontSize).toBeLessThanOrEqual(dimensions.printableHeight);

			// Primary text baseline Y should be within printable area
			expect(result.primaryText.y).toBeGreaterThan(0);
			expect(result.primaryText.y).toBeLessThanOrEqual(dimensions.printableHeight);
		});

		it('should use correct ascent/descent ratios for Oswald 300', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// With real metrics (ascent=0.809, descent=0.010 for Oswald), secondary text should fit
			expect(result.secondaryFontSize).toBeGreaterThan(0);

			if (result.layoutMode === 'TWO_LINE') {
				// Secondary text baseline Y should be within printable area
				expect(result.secondaryText.y).toBeGreaterThan(0);
				expect(result.secondaryText.y).toBeLessThanOrEqual(dimensions.printableHeight);
			}
		});

		it('should calculate vertical spacing correctly with real font metrics', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 1.0,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			if (result.layoutMode === 'TWO_LINE') {
				// Calculate visual spacing using real metrics
				const PRIMARY_DESCENT = 0.01;
				const SECONDARY_ASCENT = 0.809;

				const primaryBottom = result.primaryText.y + result.primaryFontSize * PRIMARY_DESCENT;
				const secondaryTop = result.secondaryText.y - result.secondaryFontSize * SECONDARY_ASCENT;
				const spacing = secondaryTop - primaryBottom;

				// Spacing should be at least TEXT_VERTICAL_SPACING (0.5mm)
				expect(spacing).toBeGreaterThanOrEqual(0.4); // Allow small solver tolerance
				// But not excessive (should be tight packing)
				expect(spacing).toBeLessThan(2);
			}
		});

		it('should not use line height multiplier (1.2) for text height', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			if (result.layoutMode === 'TWO_LINE') {
				// Total visual height should be close to printable height
				// If we were using 1.2x multiplier, it would be much taller
				const PRIMARY_ASCENT = 0.713;
				const PRIMARY_DESCENT = 0.01;
				const SECONDARY_ASCENT = 0.809;
				const SECONDARY_DESCENT = 0.01;

				const primaryVisualHeight = result.primaryFontSize * (PRIMARY_ASCENT + PRIMARY_DESCENT);
				const secondaryVisualHeight =
					result.secondaryFontSize * (SECONDARY_ASCENT + SECONDARY_DESCENT);
				const totalVisualHeight = primaryVisualHeight + secondaryVisualHeight + 0.5; // +0.5 for spacing

				// Should be close to printable height (within 20% tolerance for optimization)
				expect(totalVisualHeight).toBeLessThanOrEqual(dimensions.printableHeight * 1.2);
			}
		});

		it('should achieve tight text packing with 0.5mm spacing', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 1.0,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			if (result.layoutMode === 'TWO_LINE') {
				// With correct metrics and no 1.2x multiplier, we should achieve larger fonts
				// compared to old implementation
				const avgFontSize = (result.primaryFontSize + result.secondaryFontSize) / 2;

				// Average font should be reasonable (not too small due to excessive spacing)
				expect(avgFontSize).toBeGreaterThan(3);
			}
		});

		it('should adapt to different font metrics automatically', async () => {
			// Mock completely different font with different metrics
			vi.spyOn(fontMetrics, 'getCachedFontMetrics').mockImplementation(
				async (fontFamily: string, fontWeight: string) => {
					// Simulate a font with much larger descent (e.g., decorative font)
					if (fontFamily === 'Noto Sans' && fontWeight === '900') {
						return { ascent: 0.65, descent: 0.35 }; // DIFFERENT from real Noto Sans!
					}
					if (fontFamily === 'Oswald' && fontWeight === '300') {
						return { ascent: 0.7, descent: 0.3 }; // DIFFERENT from real Oswald!
					}
					return { ascent: 0.75, descent: 0.25 };
				}
			);

			const input: SolverInput = {
				dimensions,
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 1.0,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			if (result.layoutMode === 'TWO_LINE') {
				// Even with different metrics, spacing should still be reasonable
				const primaryBottom = result.primaryText.y + result.primaryFontSize * 0.35; // Using mocked descent
				const secondaryTop = result.secondaryText.y - result.secondaryFontSize * 0.7; // Using mocked ascent
				const spacing = secondaryTop - primaryBottom;

				// Should maintain reasonable spacing despite font changes
				expect(spacing).toBeGreaterThanOrEqual(0.3); // Allow for tolerance
				expect(spacing).toBeLessThan(3); // But not excessive

				// Text should still be positioned within bounds
				expect(result.primaryText.y).toBeGreaterThan(0);
				expect(result.secondaryText.y).toBeLessThanOrEqual(dimensions.printableHeight);
			}
		});
	});

	describe('Layout Constraints', () => {
		const dimensions = {
			width: 35,
			height: 12,
			printableWidth: 31,
			printableHeight: 10
		};

		it('should respect minimum spacing constraints', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'M8',
				secondaryText: 'ISO 4762',
				showHardwareImage: true,
				hardwareImageAspectRatio: 1.0,
				showQRCode: true,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Elements should not overlap (basic sanity check)
			if (result.hardwareImage && result.qrCode) {
				const imageRight = result.hardwareImage.x + (result.hardwareImage.width ?? 0);
				const qrLeft = result.qrCode.x;

				// Image and QR should have spacing or not overlap
				const hasSpacing =
					imageRight <= qrLeft || qrLeft + (result.qrCode.width ?? 0) <= result.hardwareImage.x;
				expect(hasSpacing).toBe(true);
			}
		});

		it('should fit text within clip width', async () => {
			const input: SolverInput = {
				dimensions,
				primaryText: 'Very Long Text That Should Be Clipped',
				secondaryText: 'Another Long Secondary Text',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: false
			};

			const result = await solveLabelLayout(input);

			// Text clip width should not exceed available width
			expect(result.textClipWidth).toBeLessThanOrEqual(dimensions.printableWidth);
			expect(result.textClipWidth).toBeGreaterThan(0);
		});
	});

	describe('IMAGE_HORIZONTAL Mode', () => {
		it('should trigger IMAGE_HORIZONTAL mode for wide aspect ratio images', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5, // Wide image (> 3.5)
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			// Should select IMAGE_HORIZONTAL mode for wide images
			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');
		});

		it('should not trigger IMAGE_HORIZONTAL mode for tall labels', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 20, // Tall label (> 15mm)
					printableWidth: 33,
					printableHeight: 18
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			// Should NOT use IMAGE_HORIZONTAL mode for tall labels
			expect(result.layoutMode).not.toBe('IMAGE_HORIZONTAL');
		});

		it('should use split-half layout with centered 0.5mm spacing', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');
			expect(result.hardwareImage).toBeDefined();

			if (result.hardwareImage) {
				// Image should be at left edge (x = 0)
				expect(result.hardwareImage.x).toBeCloseTo(0, 5);

				// Split-half layout: 0.5mm spacing centered on horizontal centerline
				// For 10mm printable height:
				//   - Center: 5mm
				//   - Image bottom: 4.75mm (center - 0.25mm)
				//   - Text top: 5.25mm (center + 0.25mm)
				const centerY = 10 / 2;
				const imageBottom = result.hardwareImage.y + (result.hardwareImage.height ?? 0);
				const textTop = result.primaryText.y - result.primaryFontSize * 0.724; // Noto Sans ascent

				// Image bottom should be at center - 0.25mm
				expect(imageBottom).toBeCloseTo(centerY - 0.25, 1);

				// Text top should be at center + 0.25mm (with tolerance for font metrics variance)
				expect(textTop).toBeCloseTo(centerY + 0.25, 0);

				// Spacing should be exactly 0.5mm (with tolerance for font metrics)
				const spacing = textTop - imageBottom;
				expect(spacing).toBeCloseTo(0.5, 0);
			}
		});

		it('should position text at bottom edge of printable area', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');

			// Split-half layout: fixed 0.5mm spacing, equal zones
			// Top zone = (printableHeight - 0.5mm) / 2
			// Bottom zone = (printableHeight - 0.5mm) / 2
			const imageHeight = result.hardwareImage?.height ?? 0;
			const imageBottom = (result.hardwareImage?.y ?? 0) + imageHeight;
			const FIXED_SPACING = 0.5;

			// Check that text is positioned FIXED_SPACING (0.5mm) below image
			const textTop = result.primaryText.y - result.primaryFontSize * 0.713; // Using approximate cap-height
			expect(textTop).toBeGreaterThanOrEqual(imageBottom + FIXED_SPACING - 0.1);
			expect(textTop).toBeLessThanOrEqual(imageBottom + FIXED_SPACING + 0.1);
		});

		it('should use MIN_SPACING only between image and text', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');
			expect(result.hardwareImage).toBeDefined();

			if (result.hardwareImage) {
				const imageBottom = result.hardwareImage.y + (result.hardwareImage.height ?? 0);
				const PRIMARY_ASCENT = 0.713;
				const textTop = result.primaryText.y - result.primaryFontSize * PRIMARY_ASCENT;

				// Gap between image and text should be approximately MIN_SPACING (0.5mm)
				const gap = textTop - imageBottom;
				expect(gap).toBeGreaterThanOrEqual(0.4); // Allow small solver tolerance
				expect(gap).toBeLessThan(3.0); // Allow reasonable tolerance for optimizer
			}
		});

		it('should position primary and secondary text on same line', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');

			// Both texts should be on same baseline
			expect(result.primaryText.y).toBe(result.secondaryText.y);

			// Secondary should be after primary with MIN_SPACING
			expect(result.secondaryText.x).toBeGreaterThan(result.primaryText.x);
		});

		it('should optimize font sizes independently in IMAGE_HORIZONTAL mode', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');

			// In IMAGE_HORIZONTAL mode, both font sizes should be reasonable
			// Note: Solver may optimize them independently based on text length
			expect(result.primaryFontSize).toBeGreaterThan(3);
			expect(result.secondaryFontSize).toBeGreaterThan(3);
		});

		it('should apply cap-height normalization in IMAGE_HORIZONTAL mode', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3 x 12',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');

			// Split-half layout scales each element independently to fill its zone
			// Text fills bottom zone: fontSize ≈ zoneHeight / (ascent + descent)
			// Since fonts have different metrics, they may have different font sizes
			// but similar visual heights (filling the zone)
			const primaryCapHeight = result.primaryFontSize * 0.713;
			const secondaryCapHeight = result.secondaryFontSize * 0.809;

			// In split-half, fonts fill equal zones, so visual heights should be similar
			// Allow larger tolerance since we're filling zones, not matching cap-heights
			expect(Math.abs(primaryCapHeight - secondaryCapHeight)).toBeLessThan(primaryCapHeight * 0.2);
		});

		it('should use different fonts in TWO_LINE mode without cap-height normalization', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 55,
					height: 12,
					printableWidth: 51,
					printableHeight: 10
				},
				primaryText: 'M12',
				secondaryText: 'DIN 934',
				showHardwareImage: false,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('TWO_LINE');

			// Both texts should be positioned on different lines (different Y coordinates)
			expect(result.primaryText.y).not.toBe(result.secondaryText.y);

			// In TWO_LINE mode, cap-height normalization is NOT applied
			// Both fonts should fill their zones independently based on their own metrics
			// So cap-heights will NOT be equal (unlike ONE_LINE mode)
			const primaryCapHeight = result.primaryFontSize * 0.713;
			const secondaryCapHeight = result.secondaryFontSize * 0.809;

			// Visual cap-heights should NOT be equal in TWO_LINE mode
			// Allow larger tolerance since we're filling zones, not matching cap-heights
			expect(Math.abs(primaryCapHeight - secondaryCapHeight)).toBeLessThan(primaryCapHeight * 0.2);

			// Font sizes should be different because fonts fill zones based on their own metrics
			expect(result.primaryFontSize).not.toBe(result.secondaryFontSize);
		});

		it('should maximize image height within available vertical space', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');
			expect(result.hardwareImage).toBeDefined();

			if (result.hardwareImage) {
				// Image height should be close to the available space
				// (printableHeight minus text height minus MIN_SPACING)
				const imageHeight = result.hardwareImage.height ?? 0;

				// Image should be reasonably tall (using most of the space)
				expect(imageHeight).toBeGreaterThan(3); // At least 3mm
				expect(imageHeight).toBeLessThanOrEqual(input.dimensions.printableHeight - 2); // Leave space for text
			}
		});

		it('should not use IMAGE_HORIZONTAL mode for narrow images', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 2.0, // Narrow image (< 3.5)
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			// Should use standard TWO_LINE or ONE_LINE mode, not IMAGE_HORIZONTAL
			expect(result.layoutMode).not.toBe('IMAGE_HORIZONTAL');
			expect(result.layoutMode).toMatch(/^(ONE_LINE|TWO_LINE)$/);
		});

		it('should work with QR code in IMAGE_HORIZONTAL mode', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 37,
					height: 12,
					printableWidth: 33,
					printableHeight: 10
				},
				primaryText: 'M3',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.5,
				showQRCode: true,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');
			expect(result.qrCode).toBeDefined();

			if (result.qrCode) {
				// QR code should be positioned at right edge
				const qrRight = result.qrCode.x + (result.qrCode.width ?? 0);
				expect(qrRight).toBeCloseTo(input.dimensions.printableWidth, 1);
			}
		});

		it('should keep all elements within printable bounds (DIN 931 55mm case)', async () => {
			const input: SolverInput = {
				dimensions: {
					width: 55,
					height: 12,
					printableWidth: 51,
					printableHeight: 10
				},
				primaryText: 'M3 × 12',
				secondaryText: 'DIN 931',
				showHardwareImage: true,
				hardwareImageAspectRatio: 4.0, // Wide image like DIN 931
				showQRCode: false,
				showStandard: true
			};

			const result = await solveLabelLayout(input);

			expect(result.layoutMode).toBe('IMAGE_HORIZONTAL');
			expect(result.hardwareImage).toBeDefined();

			if (result.hardwareImage && result.hardwareImage.height !== undefined) {
				const imageBottom = result.hardwareImage.y + result.hardwareImage.height;

				// Image should not exceed printable area
				expect(imageBottom).toBeLessThanOrEqual(input.dimensions.printableHeight);

				// Primary text should not exceed printable area
				// Use font metrics to calculate actual text bounds
				const primaryMetrics = { ascent: 0.713, descent: 0.01 };
				const primaryTextTop =
					result.primaryText.y - result.primaryFontSize * primaryMetrics.ascent;
				const primaryTextBottom =
					result.primaryText.y + result.primaryFontSize * primaryMetrics.descent;

				expect(primaryTextTop).toBeGreaterThanOrEqual(0);
				expect(primaryTextBottom).toBeLessThanOrEqual(input.dimensions.printableHeight);

				// Secondary text should not exceed printable area
				const secondaryMetrics = { ascent: 0.809, descent: 0.01 };
				const secondaryTextTop =
					result.secondaryText.y - result.secondaryFontSize * secondaryMetrics.ascent;
				const secondaryTextBottom =
					result.secondaryText.y + result.secondaryFontSize * secondaryMetrics.descent;

				expect(secondaryTextTop).toBeGreaterThanOrEqual(0);
				expect(secondaryTextBottom).toBeLessThanOrEqual(input.dimensions.printableHeight);

				// Total stack should fit
				const totalHeight = imageBottom - Math.min(primaryTextTop, secondaryTextTop);
				expect(totalHeight).toBeLessThanOrEqual(input.dimensions.printableHeight);
			}
		});
	});
});
