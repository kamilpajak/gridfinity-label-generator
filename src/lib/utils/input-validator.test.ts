import { describe, it, expect } from 'vitest';
import {
	validateThreadSize,
	validateLength,
	validateQRCodeUrl,
	validateText
} from './input-validator';

describe('validateThreadSize', () => {
	describe('invalid thread sizes', () => {
		it('should reject empty inputs', () => {
			expect(validateThreadSize('')).toEqual({
				isValid: false,
				message: 'Thread size is required'
			});
			expect(validateThreadSize('   ')).toEqual({
				isValid: false,
				message: 'Thread size is required'
			});
			expect(validateThreadSize(null)).toEqual({
				isValid: false,
				message: 'Thread size is required'
			});
			expect(validateThreadSize(undefined)).toEqual({
				isValid: false,
				message: 'Thread size is required'
			});
		});

		it('should reject invalid metric formats', () => {
			expect(validateThreadSize('M')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('M-8')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('8M')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('MM8')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
		});

		it('should reject thread sizes with pitch notation', () => {
			expect(validateThreadSize('M8x1.25')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('M10x1.5')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
		});

		it('should reject invalid imperial formats', () => {
			expect(validateThreadSize('#')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('#A')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('1/')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('/4')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
		});

		it('should reject mixed numbers (those belong in length field)', () => {
			expect(validateThreadSize('1 1/4')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('2 3/4')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
		});

		it('should reject plain text and numbers', () => {
			expect(validateThreadSize('abc')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
			expect(validateThreadSize('123')).toEqual({
				isValid: false,
				message: 'Invalid thread size format'
			});
		});
	});
});

describe('validateLength', () => {
	describe('invalid lengths', () => {
		it('should reject empty inputs', () => {
			expect(validateLength('')).toEqual({
				isValid: false,
				message: 'Length is required'
			});
			expect(validateLength('   ')).toEqual({
				isValid: false,
				message: 'Length is required'
			});
			expect(validateLength(null)).toEqual({
				isValid: false,
				message: 'Length is required'
			});
			expect(validateLength(undefined)).toEqual({
				isValid: false,
				message: 'Length is required'
			});
		});

		it('should reject lengths with units', () => {
			expect(validateLength('10mm')).toEqual({
				isValid: false,
				message: 'Invalid length format (do not include units)'
			});
			expect(validateLength('25 mm')).toEqual({
				isValid: false,
				message: 'Invalid length format (do not include units)'
			});
			expect(validateLength('1in')).toEqual({
				isValid: false,
				message: 'Invalid length format (do not include units)'
			});
			expect(validateLength('1/4″')).toEqual({
				isValid: false,
				message: 'Invalid length format (do not include units)'
			});
			expect(validateLength('1 1/4"')).toEqual({
				isValid: false,
				message: 'Invalid length format (do not include units)'
			});
		});

		it('should reject invalid numeric formats', () => {
			expect(validateLength('10.')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
			expect(validateLength('.5')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
			expect(validateLength('10.a')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
		});

		it('should reject invalid fractions', () => {
			expect(validateLength('1/')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
			expect(validateLength('/4')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
			expect(validateLength('1//4')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
			expect(validateLength('1 /')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
			expect(validateLength('1 /2')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
		});

		it('should reject multiple mixed numbers', () => {
			expect(validateLength('1 1/2 3/4')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
		});

		it('should reject plain text', () => {
			expect(validateLength('abc')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
			expect(validateLength('ten')).toEqual({
				isValid: false,
				message: 'Invalid length format'
			});
		});

		it('should reject lengths above the maximum', () => {
			expect(validateLength('1000')).toEqual({ isValid: true });
			expect(validateLength('1001')).toEqual({
				isValid: false,
				message: 'Length must be 1000 or less'
			});
			expect(validateLength('999999')).toEqual({
				isValid: false,
				message: 'Length must be 1000 or less'
			});
			// Imperial magnitudes are bounded too (fractions/mixed parse to a number).
			expect(validateLength('2000', 'imperial')).toEqual({
				isValid: false,
				message: 'Length must be 1000 or less'
			});
			expect(validateLength('1 1/2', 'imperial')).toEqual({ isValid: true });
		});
	});
});

describe('validateQRCodeUrl', () => {
	describe('invalid URLs', () => {
		it('should reject empty inputs', () => {
			expect(validateQRCodeUrl('')).toEqual({
				isValid: false,
				message: 'URL is required'
			});
			expect(validateQRCodeUrl('   ')).toEqual({
				isValid: false,
				message: 'URL is required'
			});
			expect(validateQRCodeUrl(null)).toEqual({
				isValid: false,
				message: 'URL is required'
			});
			expect(validateQRCodeUrl(undefined)).toEqual({
				isValid: false,
				message: 'URL is required'
			});
		});

		it('should reject URLs without protocol', () => {
			expect(validateQRCodeUrl('example.com')).toEqual({
				isValid: false,
				message: 'URL must start with http:// or https://'
			});
			expect(validateQRCodeUrl('www.example.com')).toEqual({
				isValid: false,
				message: 'URL must start with http:// or https://'
			});
		});

		it('should reject non-http/https protocols', () => {
			expect(validateQRCodeUrl('ftp://example.com')).toEqual({
				isValid: false,
				message: 'URL must start with http:// or https://'
			});
			expect(validateQRCodeUrl('mailto:test@example.com')).toEqual({
				isValid: false,
				message: 'URL must start with http:// or https://'
			});
		});

		it('should reject malformed URLs', () => {
			expect(validateQRCodeUrl('http://')).toEqual({
				isValid: false,
				message: 'Invalid URL format'
			});
			expect(validateQRCodeUrl('https://.')).toEqual({
				isValid: false,
				message: 'Invalid URL format'
			});
			expect(validateQRCodeUrl('http://example')).toEqual({
				isValid: false,
				message: 'Invalid URL format'
			});
		});

		it('should reject plain text', () => {
			expect(validateQRCodeUrl('just some text')).toEqual({
				isValid: false,
				message: 'URL must start with http:// or https://'
			});
			expect(validateQRCodeUrl('not a url at all')).toEqual({
				isValid: false,
				message: 'URL must start with http:// or https://'
			});
		});
	});
});

describe('validateText', () => {
	const MIN_LENGTH = 1;
	const MAX_LENGTH = 50;

	describe('invalid text', () => {
		it('should reject empty text when minLength > 0', () => {
			expect(validateText('', MIN_LENGTH, MAX_LENGTH)).toEqual({
				isValid: false,
				message: 'Text is required'
			});
			expect(validateText('   ', MIN_LENGTH, MAX_LENGTH)).toEqual({
				isValid: false,
				message: 'Text is required'
			});
			expect(validateText(null, MIN_LENGTH, MAX_LENGTH)).toEqual({
				isValid: false,
				message: 'Text is required'
			});
			expect(validateText(undefined, MIN_LENGTH, MAX_LENGTH)).toEqual({
				isValid: false,
				message: 'Text is required'
			});
		});

		it('should reject text exceeding maxLength', () => {
			const longText = 'A'.repeat(MAX_LENGTH + 1);
			expect(validateText(longText, MIN_LENGTH, MAX_LENGTH)).toEqual({
				isValid: false,
				message: `Text must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters`
			});

			const veryLongText = 'A'.repeat(MAX_LENGTH * 2);
			expect(validateText(veryLongText, MIN_LENGTH, MAX_LENGTH)).toEqual({
				isValid: false,
				message: `Text must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters`
			});
		});
	});
});
