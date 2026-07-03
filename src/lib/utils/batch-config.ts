import type { BatchLabelConfig, CustomImage } from '$lib/types/batch';
import { parseFraction } from './fraction-parser';

/**
 * A snapshot of the single-mode form state, used to build a batch label config
 * when the user clicks "Add Current Label".
 */
export interface FormStateSnapshot {
	labelMode: string; // 'fastener' | 'general'
	measurementSystem: 'metric' | 'imperial';
	threadSize: string;
	pitch: string;
	threadType: string;
	length: string;
	primaryText: string;
	secondaryText: string;
	optionalNote: string;
	qrCodeUrl: string;
	selectedStandardId: string;
	showStandard: boolean;
	showHardwareImage: boolean;
	showQRCode: boolean;
	labelWidth: number;
	customImage?: CustomImage;
	showCustomImage: boolean;
}

/**
 * Convert the current single-mode form state into a `BatchLabelConfig` (without
 * an id — the store assigns one on `addLabel`). This is the single source of
 * truth for the "Add Current Label" snapshot, mirroring the single-mode export
 * mapping so a batch label renders identically to its single-mode preview.
 *
 * The `qrCode` is passed through as-is; the store strips it when the batch tape
 * height is 9mm.
 */
export function formStateToBatchConfig(s: FormStateSnapshot): BatchLabelConfig {
	if (s.labelMode === 'fastener') {
		return {
			mode: 'fastener',
			measurementSystem: s.measurementSystem,
			threadSize: s.threadSize,
			pitch: s.pitch || undefined,
			threadType: s.threadType || undefined,
			length: parseFraction(s.length),
			width: s.labelWidth,
			standard: s.selectedStandardId || undefined,
			note: s.optionalNote || undefined,
			qrCode: s.qrCodeUrl || undefined,
			showImage: s.showHardwareImage,
			showReference: s.showStandard,
			showQRCode: s.showQRCode
		};
	}

	return {
		mode: 'general',
		primaryText: s.primaryText,
		secondaryText: s.secondaryText || undefined,
		width: s.labelWidth,
		note: s.optionalNote || undefined,
		qrCode: s.qrCodeUrl || undefined,
		showQRCode: s.showQRCode,
		customImage: s.customImage,
		showCustomImage: s.showCustomImage
	};
}
