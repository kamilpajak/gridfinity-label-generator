export type LabelMode = 'fastener' | 'general';
export type TapeHeight = 9 | 12;

export interface FastenerLabelConfig {
	mode: 'fastener';
	measurementSystem: 'metric' | 'imperial';
	threadSize: string;
	pitch?: string; // Thread pitch (e.g., '24', '32' for imperial UNC/UNF)
	threadType?: string; // Thread type (e.g., 'UNC', 'UNF' for imperial, 'standard', 'fine' for metric)
	length?: number;
	width: number; // Label width in mm (30-80)
	standard?: string;
	note?: string;
	qrCode?: string;
	// Toggle flags for visual elements (defaults to true if undefined)
	showImage?: boolean; // Show hardware image from standard
	showReference?: boolean; // Show standard reference text (e.g., "ISO 4017")
	showQRCode?: boolean; // Show QR code if qrCode data provided
}

/**
 * Custom image data for general labels
 * Stored as embedded base64 in localStorage
 */
export interface CustomImage {
	/** Base64 data URL of the processed image */
	data: string;
	/** Aspect ratio (width/height) for constraint solver */
	aspectRatio: number;
	/** Original filename for display */
	originalName?: string;
}

export interface GeneralLabelConfig {
	mode: 'general';
	primaryText: string;
	secondaryText?: string;
	width: number; // Label width in mm (30-80)
	note?: string;
	qrCode?: string;
	// Toggle flag for visual elements (defaults to true if undefined)
	showQRCode?: boolean; // Show QR code if qrCode data provided
	// Custom image support
	customImage?: CustomImage;
	showCustomImage?: boolean; // Show custom image if provided (defaults to true)
}

export type BatchLabelConfig = FastenerLabelConfig | GeneralLabelConfig;

export interface BatchState {
	height: TapeHeight;
	labels: BatchLabelConfig[];
	maxLabels: number;
}

export const DEFAULT_BATCH_STATE: BatchState = {
	height: 12,
	labels: [],
	maxLabels: 20
};
