/**
 * Tests for imperial fraction handling in batch mode
 *
 * BUG REPORT: Users report that fractions like "1/4", "3/8" don't work in batch mode.
 * Root cause: parseFloat("1/4") returns 1, losing the fraction.
 *
 * User quotes:
 * - "Can't add fractions on batch labels"
 * - "Batch mode doesn't work with Imperial fractions"
 * - "Would be nice to be able to put decimal sizes (0.25 instead of 1/4)"
 */

import { describe, it, expect } from 'vitest';
import { parseFraction, decimalToFraction } from './fraction-parser';

describe('Imperial Fraction Parsing - BUG Documentation', () => {
	describe('Current broken behavior with parseFloat', () => {
		it('BUG: parseFloat loses fraction - "1/4" becomes 1', () => {
			// This documents the current broken behavior
			const input = '1/4';
			const result = parseFloat(input);

			// parseFloat stops at first non-numeric character
			expect(result).toBe(1); // BUG: Should be 0.25
			expect(result).not.toBe(0.25);
		});

		it('BUG: parseFloat loses fraction - "3/8" becomes 3', () => {
			const input = '3/8';
			const result = parseFloat(input);

			expect(result).toBe(3); // BUG: Should be 0.375
			expect(result).not.toBe(0.375);
		});

		it('BUG: parseFloat loses fraction - "5/16" becomes 5', () => {
			const input = '5/16';
			const result = parseFloat(input);

			expect(result).toBe(5); // BUG: Should be 0.3125
		});
	});

	describe('Proposed fix: parseFraction helper', () => {
		it('should parse simple fractions correctly', () => {
			expect(parseFraction('1/4')).toBeCloseTo(0.25);
			expect(parseFraction('1/2')).toBeCloseTo(0.5);
			expect(parseFraction('3/4')).toBeCloseTo(0.75);
			expect(parseFraction('3/8')).toBeCloseTo(0.375);
			expect(parseFraction('5/16')).toBeCloseTo(0.3125);
			expect(parseFraction('7/8')).toBeCloseTo(0.875);
		});

		it('should parse mixed fractions correctly', () => {
			expect(parseFraction('1-1/2')).toBeCloseTo(1.5);
			expect(parseFraction('2-3/4')).toBeCloseTo(2.75);
			expect(parseFraction('1 1/4')).toBeCloseTo(1.25);
		});

		it('should parse regular numbers correctly', () => {
			expect(parseFraction('10')).toBe(10);
			expect(parseFraction('0.25')).toBeCloseTo(0.25);
			expect(parseFraction('1.5')).toBeCloseTo(1.5);
		});

		it('should handle empty/invalid input', () => {
			expect(parseFraction('')).toBeUndefined();
			expect(parseFraction('   ')).toBeUndefined();
			expect(parseFraction('abc')).toBeUndefined();
		});

		it('should handle whitespace', () => {
			expect(parseFraction('  1/4  ')).toBeCloseTo(0.25);
			expect(parseFraction(' 3/8 ')).toBeCloseTo(0.375);
		});
	});

	describe('Round-trip: fraction → decimal → fraction', () => {
		it('should convert common imperial fractions back correctly', () => {
			const fractions = ['1/4', '1/2', '3/4', '1/8', '3/8', '5/8', '7/8', '1/16', '3/16', '5/16'];

			for (const frac of fractions) {
				const decimal = parseFraction(frac);
				expect(decimal).toBeDefined();

				const backToFraction = decimalToFraction(decimal!);
				expect(backToFraction).toBe(frac);
			}
		});
	});
});

describe('Batch Mode Imperial Length - Integration Requirements', () => {
	it('should preserve imperial fraction when creating batch label', () => {
		// This test documents the expected behavior after fix
		const userInput = '1/4';

		// Current broken flow:
		// 1. User types "1/4" in length field
		// 2. updateLabel() calls parseFloat("1/4") → returns 1
		// 3. Label stored with length: 1
		// 4. Renderer shows "1" instead of "1/4"

		// Expected fixed flow:
		// 1. User types "1/4" in length field
		// 2. updateLabel() calls parseFraction("1/4") → returns 0.25
		// 3. Label stored with length: 0.25
		// 4. Renderer converts 0.25 back to "1/4" for display

		const parsed = parseFraction(userInput);
		expect(parsed).toBeCloseTo(0.25);

		const displayed = decimalToFraction(parsed!);
		expect(displayed).toBe('1/4');
	});

	it('should handle common imperial fastener lengths', () => {
		const commonLengths = [
			{ input: '1/4', expected: 0.25 },
			{ input: '3/8', expected: 0.375 },
			{ input: '1/2', expected: 0.5 },
			{ input: '5/8', expected: 0.625 },
			{ input: '3/4', expected: 0.75 },
			{ input: '1', expected: 1 },
			{ input: '1-1/4', expected: 1.25 },
			{ input: '1-1/2', expected: 1.5 },
			{ input: '2', expected: 2 }
		];

		for (const { input, expected } of commonLengths) {
			const parsed = parseFraction(input);
			expect(parsed).toBeCloseTo(expected, 3);
		}
	});
});
