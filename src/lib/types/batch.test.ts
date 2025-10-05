import { describe, it, expect } from 'vitest';
import type { FastenerLabelConfig, GeneralLabelConfig } from './batch';

describe('BatchLabelConfig Types', () => {
	describe('Toggle flags for FastenerLabelConfig', () => {
		it('should allow showImage flag (defaults to true)', () => {
			const label: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				showImage: false
			};

			expect(label.showImage).toBe(false);
		});

		it('should allow showReference flag (defaults to true)', () => {
			const label: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				showReference: false
			};

			expect(label.showReference).toBe(false);
		});

		it('should allow showQRCode flag (defaults to true)', () => {
			const label: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				showQRCode: false
			};

			expect(label.showQRCode).toBe(false);
		});

		it('should allow all toggle flags together', () => {
			const label: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				showImage: true,
				showReference: false,
				showQRCode: true
			};

			expect(label.showImage).toBe(true);
			expect(label.showReference).toBe(false);
			expect(label.showQRCode).toBe(true);
		});

		it('should allow toggle flags to be omitted (undefined)', () => {
			const label: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35
			};

			expect(label.showImage).toBeUndefined();
			expect(label.showReference).toBeUndefined();
			expect(label.showQRCode).toBeUndefined();
		});
	});

	describe('Toggle flags for GeneralLabelConfig', () => {
		it('should allow showQRCode flag (defaults to true)', () => {
			const label: GeneralLabelConfig = {
				mode: 'general',
				primaryText: 'Test Item',
				width: 35,
				showQRCode: false
			};

			expect(label.showQRCode).toBe(false);
		});

		it('should not allow showImage flag (not applicable for general mode)', () => {
			const label: GeneralLabelConfig = {
				mode: 'general',
				primaryText: 'Test Item',
				width: 35
			};

			// @ts-expect-error - showImage should not exist on GeneralLabelConfig
			expect(label.showImage).toBeUndefined();
		});

		it('should not allow showReference flag (not applicable for general mode)', () => {
			const label: GeneralLabelConfig = {
				mode: 'general',
				primaryText: 'Test Item',
				width: 35
			};

			// @ts-expect-error - showReference should not exist on GeneralLabelConfig
			expect(label.showReference).toBeUndefined();
		});
	});

	describe('Semantic meaning of toggle flags', () => {
		it('showImage controls hardware image visibility independent of standard selection', () => {
			const withImageOn: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				standard: 'iso-4017',
				showImage: true
			};

			const withImageOff: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				standard: 'iso-4017',
				showImage: false
			};

			// Both have standard, but showImage controls whether image is rendered
			expect(withImageOn.standard).toBe(withImageOff.standard);
			expect(withImageOn.showImage).toBe(true);
			expect(withImageOff.showImage).toBe(false);
		});

		it('showReference controls standard reference text visibility independent of standard selection', () => {
			const withReferenceOn: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				standard: 'iso-4017',
				showReference: true
			};

			const withReferenceOff: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				standard: 'iso-4017',
				showReference: false
			};

			// Both have standard, but showReference controls whether text is rendered
			expect(withReferenceOn.standard).toBe(withReferenceOff.standard);
			expect(withReferenceOn.showReference).toBe(true);
			expect(withReferenceOff.showReference).toBe(false);
		});

		it('showQRCode controls QR code visibility independent of qrCode data', () => {
			const withQROn: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				qrCode: 'https://example.com',
				showQRCode: true
			};

			const withQROff: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				qrCode: 'https://example.com',
				showQRCode: false
			};

			// Both have QR data, but showQRCode controls whether it's rendered
			expect(withQROn.qrCode).toBe(withQROff.qrCode);
			expect(withQROn.showQRCode).toBe(true);
			expect(withQROff.showQRCode).toBe(false);
		});
	});
});
