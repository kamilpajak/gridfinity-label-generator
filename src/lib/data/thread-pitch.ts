/**
 * Thread pitch data for imperial (UNC/UNF) and metric fasteners
 */

import { HardwareType, type ThreadSizeSystem } from './standards';

export interface PitchOption {
	value: string; // Pitch value (e.g., '24' for imperial, '1.5' for metric)
	label: string; // Display label (e.g., '24 TPI (UNC)', '1.5mm (standard)')
	type: 'UNC' | 'UNF' | 'standard' | 'fine' | 'extra-fine'; // Thread type
}

export const imperialThreadPitches: Record<string, PitchOption[]> = {
	'#0': [
		{ value: '80', label: '80 TPI (UNC)', type: 'UNC' }
		// Note: #0 has no standard UNF pitch per ANSI/ASME B1.1
	],
	'#2': [
		{ value: '56', label: '56 TPI (UNC)', type: 'UNC' },
		{ value: '64', label: '64 TPI (UNF)', type: 'UNF' }
	],
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

/**
 * Standard metric thread sizes (ISO)
 */
export const metricSizes = [
	'M1.4',
	'M1.6',
	'M2',
	'M2.5',
	'M3',
	'M4',
	'M5',
	'M6',
	'M8',
	'M10',
	'M12',
	'M16',
	'M20'
];

/**
 * Standard imperial thread sizes (ANSI/ASME)
 */
export const imperialSizes = [
	'#0',
	'#2',
	'#4',
	'#6',
	'#8',
	'#10',
	'1/4″',
	'5/16″',
	'3/8″',
	'1/2″',
	'5/8″'
];

/**
 * Self-tapping sheet metal screw sizes (ISO 1478)
 * These are dedicated sizes for thread-forming screws in sheet metal.
 * Note: ST3.5 is a standard size here (unlike non-standard M3.5)
 */
export const selfTappingSizes = [
	'ST2.2',
	'ST2.9',
	'ST3.5',
	'ST3.9',
	'ST4.2',
	'ST4.8',
	'ST5.5',
	'ST6.3'
];

/**
 * Wood screw sizes (DIN 571, DIN 7997, etc.)
 * Plain diameter values in mm without prefix.
 */
export const woodScrewSizes = ['3', '3.5', '4', '4.5', '5', '6', '8', '10'];

/**
 * Standard IDs that are wood screws (not sheet metal self-tapping)
 * These use plain diameter sizes instead of ST series.
 */
export const WOOD_SCREW_STANDARD_IDS = ['din571', 'din7997', 'din95', 'din96', 'din97'];

/**
 * Minimal standard interface for thread size system determination
 */
interface StandardForThreadSize {
	id: string;
	hardwareType?: string;
	threadSizeSystem?: ThreadSizeSystem;
}

/**
 * Determine the thread size system for a given standard
 * @param standard - Standard object with id, hardwareType, and optional threadSizeSystem
 * @param measurementSystem - User's selected measurement system
 * @returns The appropriate thread size system
 */
export function getThreadSizeSystem(
	standard: StandardForThreadSize | undefined,
	measurementSystem: 'metric' | 'imperial'
): ThreadSizeSystem {
	// No standard selected - use measurement system
	if (!standard) {
		return measurementSystem === 'metric' ? 'iso_metric' : 'uts';
	}

	// Explicit override takes precedence
	if (standard.threadSizeSystem) {
		return standard.threadSizeSystem;
	}

	// Smart defaults for self-tapping
	if (standard.hardwareType === HardwareType.SELF_TAPPING) {
		// Wood screws use nominal shank diameter (no thread standard)
		if (WOOD_SCREW_STANDARD_IDS.includes(standard.id)) {
			return 'nominal';
		}
		// Other self-tapping (sheet metal) use tapping screw thread per ISO 1478
		return 'tapping';
	}

	// Default to measurement system
	return measurementSystem === 'metric' ? 'iso_metric' : 'uts';
}

/**
 * Get available thread sizes based on measurement system, hardware type, and standard
 * @param measurementSystem - 'metric' or 'imperial'
 * @param hardwareType - Hardware type string (e.g., 'screw', 'self_tapping')
 * @param standardId - Optional standard ID for more precise size selection
 * @returns Array of thread size strings
 */
export function getThreadSizes(
	measurementSystem: 'metric' | 'imperial',
	hardwareType?: string,
	standardId?: string
): string[] {
	// Determine thread size system
	// Pass standard info if we have either standardId or hardwareType
	const standardInfo =
		standardId || hardwareType ? { id: standardId || '', hardwareType } : undefined;
	const system = getThreadSizeSystem(standardInfo, measurementSystem);

	// Return appropriate sizes based on system
	switch (system) {
		case 'tapping':
			return selfTappingSizes;
		case 'nominal':
			return woodScrewSizes;
		case 'uts':
			return imperialSizes;
		case 'iso_metric':
		default:
			return metricSizes;
	}
}
