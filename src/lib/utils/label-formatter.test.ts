import { describe, it, expect } from 'vitest';
import {
	formatPrimaryText,
	formatSecondaryText,
	isLabelValid,
	appendOptionalNote
} from './label-formatter';
import { HardwareType } from '$lib/data/standards';

describe('formatPrimaryText', () => {
	describe('Metric threads with pitch', () => {
		it('should format M5 with 0.5mm pitch and 20mm length as M5 × 0.5 × 20', () => {
			const result = formatPrimaryText('fastener', 'M5', '20', '', '0.5');
			expect(result).toBe('M5 × 0.5 × 20');
		});

		it('should format M10 with 1.5mm pitch and 50mm length as M10 × 1.5 × 50', () => {
			const result = formatPrimaryText('fastener', 'M10', '50', '', '1.5');
			expect(result).toBe('M10 × 1.5 × 50');
		});

		it('should format M3 with 0.5mm pitch and no length as M3 × 0.5 (for taps/dies)', () => {
			const result = formatPrimaryText('fastener', 'M3', '', '', '0.5');
			expect(result).toBe('M3 × 0.5');
		});

		it('should format M8 without pitch and 25mm length as M8 × 25 (standard pitch implied)', () => {
			const result = formatPrimaryText('fastener', 'M8', '25', '');
			expect(result).toBe('M8 × 25');
		});
	});

	describe('Wood screws (self-tapping, no metric thread)', () => {
		it('should format wood screw M5 with 20mm length as 5 × 20 (strip M prefix)', () => {
			const result = formatPrimaryText('fastener', 'M5', '20', '', '', '', HardwareType.WOOD_SCREW);
			expect(result).toBe('5 × 20');
		});

		it('should format wood screw M4 with 30mm length as 4 × 30 (strip M prefix)', () => {
			const result = formatPrimaryText('fastener', 'M4', '30', '', '', '', HardwareType.WOOD_SCREW);
			expect(result).toBe('4 × 30');
		});

		it('should format wood screw M3 without length as 3 (strip M prefix)', () => {
			const result = formatPrimaryText('fastener', 'M3', '', '', '', '', HardwareType.WOOD_SCREW);
			expect(result).toBe('3');
		});

		it('should keep regular metric screw M5 with 20mm length as M5 × 20 (keep M prefix)', () => {
			const result = formatPrimaryText('fastener', 'M5', '20', '', '', '', HardwareType.SCREW);
			expect(result).toBe('M5 × 20');
		});
	});

	describe('Imperial threads with TPI (ASME B1.1 format)', () => {
		it('should format #10 with 32 TPI and 1 inch length as #10−32 × 1"', () => {
			const result = formatPrimaryText('fastener', '#10', '1', '', '32');
			expect(result).toBe('#10−32 × 1"');
		});

		it('should format 1/4 with 20 TPI and 2 inch length as 1/4−20 × 2"', () => {
			const result = formatPrimaryText('fastener', '1/4', '2', '', '20');
			expect(result).toBe('1/4−20 × 2"');
		});

		it('should format 1/4 with 20 TPI and no length as 1/4−20 (for taps/dies)', () => {
			const result = formatPrimaryText('fastener', '1/4', '', '', '20');
			expect(result).toBe('1/4−20');
		});

		it('should format fractional inch sizes with decimal lengths', () => {
			const result = formatPrimaryText('fastener', '3/8', '2.5', '', '16');
			expect(result).toBe('3/8−16 × 2.5"');
		});

		it('should format imperial gauge without TPI and length', () => {
			const result = formatPrimaryText('fastener', '#8', '1.5', '');
			expect(result).toBe('#8 × 1.5"');
		});
	});

	describe('Fastener mode without pitch or length', () => {
		it('should return only thread size when no pitch or length provided', () => {
			const result = formatPrimaryText('fastener', 'M6', '', '');
			expect(result).toBe('M6');
		});

		it('should return empty string when no thread size provided', () => {
			const result = formatPrimaryText('fastener', '', '20', '');
			expect(result).toBe('');
		});
	});

	describe('General mode', () => {
		it('should return custom primary text in general mode', () => {
			const result = formatPrimaryText('general', '', '', 'Custom Label');
			expect(result).toBe('Custom Label');
		});

		it('should ignore thread size in general mode', () => {
			const result = formatPrimaryText('general', 'M5', '20', 'Custom Text');
			expect(result).toBe('Custom Text');
		});

		it('should return empty string when no primary text in general mode', () => {
			const result = formatPrimaryText('general', '', '', '');
			expect(result).toBe('');
		});
	});
});

describe('formatSecondaryText', () => {
	it('should return secondary text in general mode', () => {
		const result = formatSecondaryText('general', 'Secondary Info');
		expect(result).toBe('Secondary Info');
	});

	it('should return empty string in fastener mode', () => {
		const result = formatSecondaryText('fastener', 'Should not appear');
		expect(result).toBe('');
	});

	it('should return empty string when no secondary text in general mode', () => {
		const result = formatSecondaryText('general', '');
		expect(result).toBe('');
	});
});

describe('isLabelValid', () => {
	describe('Fastener mode', () => {
		it('should be valid when thread size and length provided', () => {
			const result = isLabelValid('fastener', 'M5', '20', '');
			expect(result).toBe(true);
		});

		it('should be invalid when thread size missing', () => {
			const result = isLabelValid('fastener', '', '20', '');
			expect(result).toBe(false);
		});

		it('should be invalid when length missing', () => {
			const result = isLabelValid('fastener', 'M5', '', '');
			expect(result).toBe(false);
		});
	});

	describe('General mode', () => {
		it('should be valid when primary text provided', () => {
			const result = isLabelValid('general', '', '', 'Custom Label');
			expect(result).toBe(true);
		});

		it('should be invalid when primary text missing', () => {
			const result = isLabelValid('general', '', '', '');
			expect(result).toBe(false);
		});

		it('should ignore thread size and length in general mode', () => {
			const result = isLabelValid('general', 'M5', '20', 'Label');
			expect(result).toBe(true);
		});
	});

	describe('Invalid mode', () => {
		it('should return false for unknown mode', () => {
			const result = isLabelValid('invalid', 'M5', '20', 'Text');
			expect(result).toBe(false);
		});
	});
});

describe('appendOptionalNote', () => {
	it('should append note to base text with proper spacing', () => {
		const result = appendOptionalNote('ISO 4762', 'Special coating');
		expect(result).toBe('ISO 4762 Special coating');
	});

	it('should return only note when base text is empty', () => {
		const result = appendOptionalNote('', 'Just a note');
		expect(result).toBe('Just a note');
	});

	it('should return base text when note is undefined', () => {
		const result = appendOptionalNote('DIN 912', undefined);
		expect(result).toBe('DIN 912');
	});

	it('should return base text when note is empty string', () => {
		const result = appendOptionalNote('DIN 912', '');
		expect(result).toBe('DIN 912');
	});

	it('should handle empty base text and undefined note', () => {
		const result = appendOptionalNote('', undefined);
		expect(result).toBe('');
	});

	it('should not add leading space when base text is empty but note exists', () => {
		const result = appendOptionalNote('', 'Note without leading space');
		expect(result).toBe('Note without leading space');
	});

	it('should properly combine base text and note without extra spaces', () => {
		const result = appendOptionalNote('M8 × 25', 'Grade 8.8');
		expect(result).toBe('M8 × 25 Grade 8.8');
	});
});
