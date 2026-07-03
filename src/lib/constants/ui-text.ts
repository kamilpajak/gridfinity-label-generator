/**
 * Centralized UI text constants for the Gridfinity Label Generator
 * This ensures consistency across single and batch label modes
 */

export const UI_TEXT = {
	productType: {
		label: 'Product Type',
		fastener: 'Fastener',
		generalItem: 'General Item'
	},
	measurementSystem: {
		label: 'System',
		metric: 'Metric',
		imperial: 'Imperial'
	},
	fields: {
		standard: 'ISO/DIN Standard',
		note: 'Note',
		threadSize: 'Thread Size',
		threadPitch: 'Thread Pitch',
		length: 'Length',
		primaryText: 'Primary Text',
		secondaryText: 'Secondary Text',
		qrCode: 'QR Code'
	},
	placeholders: {
		selectStandard: 'Select standard...',
		searchStandards: 'Search standards...',
		note: 'A2, A4, INOX, 8.8, 10.9...',
		selectSize: 'Select size...',
		selectThreadSize: 'Select thread size',
		selectPitch: 'Select pitch...',
		standardPitchMetric: 'Standard pitch',
		standardPitchImperial: 'Standard/Coarse',
		lengthMetric: '5, 25, 50...',
		lengthImperial: '1/4, 3/8...',
		lengthNA: 'N/A for this hardware type',
		primaryText: 'e.g., Resistors 10kΩ',
		secondaryText: 'e.g., 1/4W ±5%',
		additionalInfo: 'Additional information...',
		qrCode: 'Text or URL for QR code'
	},
	/**
	 * Reusable label fragments for form fields.
	 * IMPORTANT: Always use these constants in Svelte templates instead of hardcoding.
	 * Example: {UI_TEXT.labels.optional} NOT "(optional)" or "(Optional)"
	 */
	labels: {
		optional: '(Optional)'
	},
	settings: {
		title: 'Label Settings',
		standardReference: {
			title: 'ISO/DIN Standard',
			description: 'Display standard designation',
			disabledGeneral: 'Not available for General items'
		},
		hardwareIcon: {
			title: 'Hardware Icon',
			description: 'Show fastener type icon',
			disabled9mm: 'Not available for 9mm labels',
			disabledGeneral: 'Not available for General items',
			exclusiveWithQR: '(exclusive with QR Code)'
		},
		qrCode: {
			title: 'QR Code',
			description: 'Add scannable code',
			disabled9mm: 'Not available for 9mm labels',
			exclusiveWithHardware: '(exclusive with Hardware Icon)'
		},
		dimensions: {
			title: 'Dimensions',
			labelHeight: 'Label Height',
			labelWidth: 'Label Width'
		}
	},
	tooltips: {
		hardwareIconUnder50mm:
			'On labels under 50mm width, enabling Hardware Icon will automatically disable QR Code to prevent overcrowding.',
		qrCodeUnder50mm:
			'On labels under 50mm width, enabling QR Code will automatically disable Hardware Icon to prevent overcrowding.'
	},
	buttons: {
		clear: 'Clear',
		downloadPNG: 'Download PNG'
	},
	cards: {
		labelSettings: 'Label Settings',
		labelPreview: 'Label Preview',
		labelOptions: 'Label Options'
	},
	errors: {
		noStandard: 'No standard with image found.',
		addTextToExport: 'Add some text to enable export',
		fixValidation: 'Fix validation errors to enable export',
		exportTitle: 'Export label as PNG',
		fastenerIncomplete:
			'Complete required fields: Standard, Thread Size, and Length (for screws/bolts)'
	}
} as const;
