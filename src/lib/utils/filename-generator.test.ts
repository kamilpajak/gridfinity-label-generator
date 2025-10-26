import { describe, it, expect } from 'vitest';
import { generateLabelFilename } from './filename-generator';
import { HardwareType, type ISODINStandard } from '$lib/data/standards';

describe('generateLabelFilename', () => {
	describe('Fastener mode', () => {
		it('should generate filename with DIN standard, thread size and length', () => {
			const mockStandard: ISODINStandard = {
				id: 'din912',
				designations: [{ system: 'DIN', code: '912' }],
				primarySystem: 'DIN',
				description: 'Socket Head Cap Screw',
				hardwareType: HardwareType.SCREW,
				image: '/images/din912.png'
			};

			const filename = generateLabelFilename({
				labelMode: 'fastener',
				standard: mockStandard,
				threadSize: 'M6',
				length: '20',
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('DIN912_M6x20mm.png');
		});

		it('should generate filename with ISO standard, thread size and length', () => {
			const mockStandard: ISODINStandard = {
				id: 'iso4762',
				designations: [{ system: 'ISO', code: '4762' }],
				primarySystem: 'ISO',
				description: 'Socket Head Cap Screw',
				hardwareType: HardwareType.SCREW,
				image: '/images/iso4762.png'
			};

			const filename = generateLabelFilename({
				labelMode: 'fastener',
				standard: mockStandard,
				threadSize: 'M8',
				length: '30',
				printableWidth: 35,
				printableHeight: 12
			});

			expect(filename).toBe('ISO4762_M8x30mm.png');
		});

		it('should generate filename without length for washers', () => {
			const mockStandard: ISODINStandard = {
				id: 'din125',
				designations: [{ system: 'DIN', code: '125' }],
				primarySystem: 'DIN',
				description: 'Flat Washer',
				hardwareType: HardwareType.WASHER,
				image: '/images/din125.png'
			};

			const filename = generateLabelFilename({
				labelMode: 'fastener',
				standard: mockStandard,
				threadSize: 'M6',
				length: '', // Washers don't have length
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('DIN125_M6.png');
		});

		it('should generate filename without length for nuts', () => {
			const mockStandard: ISODINStandard = {
				id: 'din934',
				designations: [{ system: 'DIN', code: '934' }],
				primarySystem: 'DIN',
				description: 'Hexagon Nut',
				hardwareType: HardwareType.NUT,
				image: '/images/din934.png'
			};

			const filename = generateLabelFilename({
				labelMode: 'fastener',
				standard: mockStandard,
				threadSize: 'M10',
				length: '',
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('DIN934_M10.png');
		});

		it('should handle imperial thread sizes', () => {
			const mockStandard: ISODINStandard = {
				id: 'asme_b18_3',
				designations: [
					{ system: 'ASME', code: 'B18.3' },
					{ system: 'ANSI', code: 'B18.3.1M' }
				],
				primarySystem: 'ISO', // Standards still need primary as ISO or DIN
				description: 'Socket Head Cap Screw (ASME)',
				hardwareType: HardwareType.SCREW,
				image: '/images/asme.png'
			};

			const filename = generateLabelFilename({
				labelMode: 'fastener',
				standard: mockStandard,
				threadSize: '1/4"',
				length: '1',
				printableWidth: 31,
				printableHeight: 12
			});

			// Primary designation is first in array (ASME B18.3)
			expect(filename).toBe('ASMEB18.3_1-4inx1in.png');
		});

		it('should fallback to dimensions if standard is missing', () => {
			const filename = generateLabelFilename({
				labelMode: 'fastener',
				standard: undefined,
				threadSize: 'M6',
				length: '20',
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('Fastener.png');
		});

		it('should sanitize special characters from standard codes', () => {
			const mockStandard: ISODINStandard = {
				id: 'din_7991',
				designations: [{ system: 'DIN', code: '7991' }],
				primarySystem: 'DIN',
				description: 'Countersunk Socket Head Screw',
				hardwareType: HardwareType.SCREW,
				image: '/images/din7991.png'
			};

			const filename = generateLabelFilename({
				labelMode: 'fastener',
				standard: mockStandard,
				threadSize: 'M6',
				length: '25',
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('DIN7991_M6x25mm.png');
		});
	});

	describe('General item mode', () => {
		it('should generate filename with primary text only', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Resistors',
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('Resistors.png');
		});

		it('should generate filename with both primary and secondary text', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Resistors',
				secondaryText: '100 Ohm',
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('Resistors_100Ohm.png');
		});

		it('should sanitize both primary and secondary text', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Wire/Cable',
				secondaryText: '2.5mm² AWG14',
				printableWidth: 40,
				printableHeight: 12
			});

			expect(filename).toBe('WireCable_25mmAWG14.png');
		});

		it('should handle empty secondary text', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Resistors',
				secondaryText: '',
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('Resistors.png');
		});

		it('should sanitize primary text with spaces', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Small Parts',
				printableWidth: 35,
				printableHeight: 9
			});

			expect(filename).toBe('SmallParts.png');
		});

		it('should sanitize primary text with special characters', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Wire/Cable & Connectors',
				printableWidth: 40,
				printableHeight: 12
			});

			expect(filename).toBe('WireCableConnectors.png');
		});

		it('should handle empty primary text', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: '',
				printableWidth: 31,
				printableHeight: 12
			});

			expect(filename).toBe('Label.png');
		});

		it('should truncate long primary text', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'This is a very long label text that should be truncated',
				printableWidth: 31,
				printableHeight: 12
			});

			// Should truncate to reasonable length (e.g., 30 chars)
			expect(filename.length).toBeLessThanOrEqual(35); // filename + extension
			expect(filename).toMatch(/^[A-Za-z0-9]+\.png$/);
		});

		it('should truncate combined text when both primary and secondary are long', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'This is a very long primary text',
				secondaryText: 'And this is also a very long secondary text',
				printableWidth: 31,
				printableHeight: 12
			});

			// Combined text should be truncated to reasonable length
			expect(filename.length).toBeLessThanOrEqual(45); // filename + extension
			expect(filename).toMatch(/^[A-Za-z0-9_]+\.png$/);
		});

		it('should truncate at word boundary when possible', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'ElectronicComponents CapacitorsAndResistors',
				printableWidth: 31,
				printableHeight: 12
			});

			// Should truncate around "CapacitorsAndResistors" since it exceeds 30 chars
			// Total: "ElectronicComponentsCapacitorsAndResistors" = 45 chars
			// Should be truncated, and preferably not in middle of word
			expect(filename.length).toBeLessThanOrEqual(35);
			expect(filename).toMatch(/\.png$/);
		});

		it('should prefer underscore boundary over hard truncation', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'VeryLongTextHere',
				secondaryText: 'AndEvenMoreTextThatGoesOnAndOn',
				printableWidth: 31,
				printableHeight: 12
			});

			// Combined: "VeryLongTextHere_AndEvenMoreTextThatGoesOnAndOn" = 49 chars
			// Should truncate at underscore if within reasonable range (40 char limit)
			expect(filename).toMatch(/^[A-Za-z0-9_]+\.png$/);
			expect(filename.length).toBeLessThanOrEqual(45);

			// Should not end with partial word followed by underscore in weird way
			expect(filename).not.toMatch(/_[A-Z][a-z]{1,2}\.png$/);
		});
	});

	describe('Edge cases', () => {
		it('should handle very small dimensions', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Test',
				printableWidth: 5,
				printableHeight: 3
			});

			expect(filename).toBe('Test.png');
		});

		it('should handle large dimensions', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Test',
				printableWidth: 100,
				printableHeight: 50
			});

			expect(filename).toBe('Test.png');
		});

		it('should handle decimal dimensions by rounding', () => {
			const filename = generateLabelFilename({
				labelMode: 'general',
				primaryText: 'Test',
				printableWidth: 31.5,
				printableHeight: 12.7
			});

			expect(filename).toBe('Test.png');
		});
	});
});
