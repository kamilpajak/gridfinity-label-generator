import { describe, it, expect } from 'vitest';
import { formStateToBatchConfig, type FormStateSnapshot } from './batch-config';
import type { FastenerLabelConfig, GeneralLabelConfig } from '$lib/types/batch';

/** A fully-populated snapshot; individual tests override just what they need. */
function snapshot(overrides: Partial<FormStateSnapshot> = {}): FormStateSnapshot {
	return {
		labelMode: 'fastener',
		measurementSystem: 'metric',
		threadSize: 'M8',
		pitch: '',
		threadType: '',
		length: '25',
		primaryText: '',
		secondaryText: '',
		optionalNote: '',
		qrCodeUrl: '',
		selectedStandardId: 'ISO 4762',
		showStandard: true,
		showHardwareImage: true,
		showQRCode: false,
		labelWidth: 35,
		customImage: undefined,
		showCustomImage: true,
		...overrides
	};
}

describe('formStateToBatchConfig', () => {
	describe('fastener mode', () => {
		it('maps the shared form fields to a fastener config', () => {
			const config = formStateToBatchConfig(
				snapshot({
					pitch: '1.25',
					threadType: 'fine',
					optionalNote: 'A2',
					selectedStandardId: 'ISO 4762',
					showStandard: true,
					showHardwareImage: false,
					showQRCode: true,
					qrCodeUrl: 'https://example.com',
					labelWidth: 40
				})
			) as FastenerLabelConfig;

			expect(config.mode).toBe('fastener');
			expect(config.measurementSystem).toBe('metric');
			expect(config.threadSize).toBe('M8');
			expect(config.pitch).toBe('1.25');
			expect(config.threadType).toBe('fine');
			expect(config.length).toBe(25);
			expect(config.width).toBe(40);
			expect(config.standard).toBe('ISO 4762');
			expect(config.note).toBe('A2');
			expect(config.qrCode).toBe('https://example.com');
			expect(config.showImage).toBe(false);
			expect(config.showReference).toBe(true);
			expect(config.showQRCode).toBe(true);
			// The store owns id generation — the snapshot must not carry one.
			expect((config as unknown as Record<string, unknown>).id).toBeUndefined();
		});

		it('turns empty optional fields into undefined (not empty strings)', () => {
			const config = formStateToBatchConfig(
				snapshot({
					pitch: '',
					threadType: '',
					optionalNote: '',
					qrCodeUrl: '',
					selectedStandardId: ''
				})
			) as FastenerLabelConfig;

			expect(config.pitch).toBeUndefined();
			expect(config.threadType).toBeUndefined();
			expect(config.note).toBeUndefined();
			expect(config.qrCode).toBeUndefined();
			expect(config.standard).toBeUndefined();
		});

		it('parses length as a number, matching single-mode export (empty → undefined, fraction → decimal)', () => {
			expect(
				(formStateToBatchConfig(snapshot({ length: '' })) as FastenerLabelConfig).length
			).toBeUndefined();
			expect(
				(formStateToBatchConfig(snapshot({ length: '50' })) as FastenerLabelConfig).length
			).toBe(50);
			expect(
				(formStateToBatchConfig(snapshot({ length: '1/4' })) as FastenerLabelConfig).length
			).toBeCloseTo(0.25);
		});
	});

	describe('general mode', () => {
		it('maps the shared form fields to a general config', () => {
			const image = { data: 'data:image/png;base64,abc', aspectRatio: 1.5 };
			const config = formStateToBatchConfig(
				snapshot({
					labelMode: 'general',
					primaryText: 'CAPACITOR',
					secondaryText: '100µF',
					optionalNote: 'note',
					qrCodeUrl: 'https://x.dev',
					showQRCode: true,
					labelWidth: 50,
					customImage: image,
					showCustomImage: true
				})
			) as GeneralLabelConfig;

			expect(config.mode).toBe('general');
			expect(config.primaryText).toBe('CAPACITOR');
			expect(config.secondaryText).toBe('100µF');
			expect(config.note).toBe('note');
			expect(config.qrCode).toBe('https://x.dev');
			expect(config.showQRCode).toBe(true);
			expect(config.width).toBe(50);
			expect(config.customImage).toEqual(image);
			expect(config.showCustomImage).toBe(true);
			// General configs must not carry fastener-only fields.
			expect((config as unknown as Record<string, unknown>).threadSize).toBeUndefined();
		});

		it('turns empty secondaryText/note into undefined', () => {
			const config = formStateToBatchConfig(
				snapshot({ labelMode: 'general', primaryText: 'X', secondaryText: '', optionalNote: '' })
			) as GeneralLabelConfig;
			expect(config.secondaryText).toBeUndefined();
			expect(config.note).toBeUndefined();
		});
	});
});
