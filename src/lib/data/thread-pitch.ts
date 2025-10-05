/**
 * Thread pitch data for imperial (UNC/UNF) and metric fasteners
 */

export interface PitchOption {
	value: string; // Pitch value (e.g., '24' for imperial, '1.5' for metric)
	label: string; // Display label (e.g., '24 TPI (UNC)', '1.5mm (standard)')
	type: 'UNC' | 'UNF' | 'standard' | 'fine' | 'extra-fine'; // Thread type
}

export const imperialThreadPitches: Record<string, PitchOption[]> = {
	'#4': [
		{ value: '40', label: '40 TPI (UNC)', type: 'UNC' },
		{ value: '48', label: '48 TPI (UNF)', type: 'UNF' }
	],
	'#6': [
		{ value: '32', label: '32 TPI (UNC)', type: 'UNC' },
		{ value: '40', label: '40 TPI (UNF)', type: 'UNF' }
	],
	'#8': [
		{ value: '32', label: '32 TPI (UNC)', type: 'UNC' },
		{ value: '36', label: '36 TPI (UNF)', type: 'UNF' }
	],
	'#10': [
		{ value: '24', label: '24 TPI (UNC)', type: 'UNC' },
		{ value: '32', label: '32 TPI (UNF)', type: 'UNF' }
	],
	'1/4″': [
		{ value: '20', label: '20 TPI (UNC)', type: 'UNC' },
		{ value: '28', label: '28 TPI (UNF)', type: 'UNF' }
	],
	'5/16″': [
		{ value: '18', label: '18 TPI (UNC)', type: 'UNC' },
		{ value: '24', label: '24 TPI (UNF)', type: 'UNF' }
	],
	'3/8″': [
		{ value: '16', label: '16 TPI (UNC)', type: 'UNC' },
		{ value: '24', label: '24 TPI (UNF)', type: 'UNF' }
	],
	'1/2″': [
		{ value: '13', label: '13 TPI (UNC)', type: 'UNC' },
		{ value: '20', label: '20 TPI (UNF)', type: 'UNF' }
	],
	'5/8″': [
		{ value: '11', label: '11 TPI (UNC)', type: 'UNC' },
		{ value: '18', label: '18 TPI (UNF)', type: 'UNF' }
	]
};

export const metricThreadPitches: Record<string, PitchOption[]> = {
	'M1.4': [{ value: '0.3', label: '0.3mm (standard)', type: 'standard' }],
	'M1.6': [{ value: '0.35', label: '0.35mm (standard)', type: 'standard' }],
	M2: [
		{ value: '0.4', label: '0.4mm (standard)', type: 'standard' },
		{ value: '0.25', label: '0.25mm (fine)', type: 'fine' }
	],
	'M2.5': [
		{ value: '0.45', label: '0.45mm (standard)', type: 'standard' },
		{ value: '0.35', label: '0.35mm (fine)', type: 'fine' }
	],
	M3: [
		{ value: '0.5', label: '0.5mm (standard)', type: 'standard' },
		{ value: '0.35', label: '0.35mm (fine)', type: 'fine' }
	],
	M4: [
		{ value: '0.7', label: '0.7mm (standard)', type: 'standard' },
		{ value: '0.5', label: '0.5mm (fine)', type: 'fine' }
	],
	M5: [
		{ value: '0.8', label: '0.8mm (standard)', type: 'standard' },
		{ value: '0.5', label: '0.5mm (fine)', type: 'fine' }
	],
	M6: [
		{ value: '1.0', label: '1.0mm (standard)', type: 'standard' },
		{ value: '0.75', label: '0.75mm (fine)', type: 'fine' }
	],
	M8: [
		{ value: '1.25', label: '1.25mm (standard)', type: 'standard' },
		{ value: '1.0', label: '1.0mm (fine)', type: 'fine' }
	],
	M10: [
		{ value: '1.5', label: '1.5mm (standard)', type: 'standard' },
		{ value: '1.25', label: '1.25mm (fine)', type: 'fine' },
		{ value: '1.0', label: '1.0mm (extra fine)', type: 'extra-fine' }
	],
	M12: [
		{ value: '1.75', label: '1.75mm (standard)', type: 'standard' },
		{ value: '1.5', label: '1.5mm (fine)', type: 'fine' },
		{ value: '1.25', label: '1.25mm (extra fine)', type: 'extra-fine' }
	],
	M16: [
		{ value: '2.0', label: '2.0mm (standard)', type: 'standard' },
		{ value: '1.5', label: '1.5mm (fine)', type: 'fine' }
	],
	M20: [
		{ value: '2.5', label: '2.5mm (standard)', type: 'standard' },
		{ value: '2.0', label: '2.0mm (fine)', type: 'fine' },
		{ value: '1.5', label: '1.5mm (extra fine)', type: 'extra-fine' }
	]
};

/**
 * Get available pitch options for a given thread size and measurement system
 */
export function getPitchOptions(
	threadSize: string,
	measurementSystem: 'metric' | 'imperial'
): PitchOption[] {
	if (measurementSystem === 'imperial') {
		return imperialThreadPitches[threadSize] || [];
	} else {
		return metricThreadPitches[threadSize] || [];
	}
}

/**
 * Check if a thread size has pitch options
 */
export function hasPitchOptions(
	threadSize: string,
	measurementSystem: 'metric' | 'imperial'
): boolean {
	if (measurementSystem === 'imperial') {
		return threadSize in imperialThreadPitches;
	} else {
		return threadSize in metricThreadPitches;
	}
}
