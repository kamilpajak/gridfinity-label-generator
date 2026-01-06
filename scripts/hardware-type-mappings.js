/**
 * Simplified Hardware Type Mappings
 *
 * Maps standard numbers to hardware types for automatic categorization
 * Following McMaster-Carr style simple categorization
 */

// Hardware type enum (matches TypeScript enum in src/lib/data/standards.ts)
const HardwareType = {
	SCREW: 'screw', // Metric thread screws
	BOLT: 'bolt', // Metric thread bolts
	WOOD_SCREW: 'wood_screw', // Wood screws (self-tapping, no pitch)
	NUT: 'nut',
	WASHER: 'washer',
	PIN: 'pin',
	RING: 'ring', // Retaining rings, snap rings
	RIVET: 'rivet',
	OTHER: 'other'
};

/**
 * Known standard number ranges by hardware type
 * Simplified categorization focusing on most common standards
 */
const hardwareTypeMappings = {
	// NUTS - No length required
	nuts: {
		type: HardwareType.NUT,
		// Common nut standards
		din: ['934', '935', '936', '937', '985', '986', '1587', '6923', '6924', '6925', '6926', '6927'],
		iso: [
			'4032',
			'4033',
			'4034',
			'4035',
			'4036',
			'7040',
			'7041',
			'7042',
			'7719',
			'10511',
			'10512',
			'10513'
		]
	},

	// WASHERS - No length required
	washers: {
		type: HardwareType.WASHER,
		// Common washer standards
		din: [
			'125',
			'126',
			'127',
			'433',
			'434',
			'435',
			'436',
			'440',
			'6796',
			'6797',
			'6798',
			'6799',
			'6916',
			'9021'
		],
		iso: ['7089', '7090', '7091', '7092', '7093', '7094', '10642', '10643', '10644']
	},

	// SCREWS
	screws: {
		type: HardwareType.SCREW,
		// Socket head cap screws, countersunk, pan head, etc.
		din: [
			'912',
			'913',
			'914',
			'915',
			'916',
			'963',
			'964',
			'965',
			'966',
			'967',
			'7991',
			'7984',
			'7985',
			'7988',
			'6912'
		],
		iso: [
			'4762',
			'4763',
			'4764',
			'4765',
			'4766',
			'2009',
			'2010',
			'7046',
			'7047',
			'10642',
			'14579',
			'14580'
		]
	},

	// BOLTS
	bolts: {
		type: HardwareType.BOLT,
		// Hex head bolts and similar
		din: [
			'931',
			'933',
			'960',
			'961',
			'558',
			'561',
			'601',
			'603',
			'604',
			'605',
			'607',
			'608',
			'609',
			'610'
		],
		iso: ['4014', '4016', '4017', '4018', '8676', '8765']
	},

	// PINS
	pins: {
		type: HardwareType.PIN,
		// Dowel pins, cotter pins, spring pins, etc.
		din: [
			'1',
			'6',
			'7',
			'94',
			'258',
			'427',
			'444',
			'1433',
			'1434',
			'1443',
			'1444',
			'1469',
			'1470',
			'1471',
			'1472',
			'1473',
			'1474',
			'1475',
			'1476',
			'1477',
			'1478',
			'1481',
			'6325',
			'7977',
			'7978',
			'7979'
		],
		iso: [
			'1234',
			'2338',
			'2339',
			'2340',
			'2341',
			'8733',
			'8734',
			'8735',
			'8736',
			'8737',
			'8739',
			'8740',
			'8741',
			'8742',
			'8743',
			'8744',
			'8745',
			'8746',
			'8747',
			'8748',
			'8749',
			'8750',
			'8751',
			'8752'
		]
	},

	// RIVETS
	rivets: {
		type: HardwareType.RIVET,
		// Blind rivets, solid rivets, etc.
		din: ['123', '124', '302', '660', '661', '662', '674', '675', '7337', '7338', '7339', '7340'],
		iso: [
			'1051',
			'14588',
			'14589',
			'15973',
			'15974',
			'15975',
			'15976',
			'15977',
			'15978',
			'15979',
			'15980',
			'15981',
			'15982',
			'15983',
			'15984'
		]
	}
};

/**
 * Determine hardware type based on standard designation
 * @param {Array} designations - Array of designation objects with system and code
 * @param {string} description - Standard description for keyword matching
 * @returns {string} Hardware type
 */
function getHardwareType(designations, description = '') {
	// Normalize description for keyword matching
	const lowerDesc = description.toLowerCase();

	// Check each category's standard numbers
	for (const config of Object.values(hardwareTypeMappings)) {
		// Check DIN codes
		if (config.din) {
			for (const designation of designations) {
				if (designation.system === 'DIN' && config.din.includes(designation.code)) {
					return config.type;
				}
			}
		}

		// Check ISO codes
		if (config.iso) {
			for (const designation of designations) {
				if (designation.system === 'ISO' && config.iso.includes(designation.code)) {
					return config.type;
				}
			}
		}
	}

	// Fallback: Check description keywords
	// Priority order matters - check more specific terms first
	if (lowerDesc.includes('nut') && !lowerDesc.includes('wing nut screws')) {
		return HardwareType.NUT;
	}
	if (lowerDesc.includes('washer')) {
		return HardwareType.WASHER;
	}
	// Check for wood screws / tapping screws before general screws
	if (
		lowerDesc.includes('wood screw') ||
		lowerDesc.includes('tapping screw') ||
		lowerDesc.includes('self-tapping') ||
		lowerDesc.includes('thread cutting') ||
		lowerDesc.includes('thread forming')
	) {
		return HardwareType.WOOD_SCREW;
	}
	// Check for rings before pins (both can have similar keywords)
	if (
		lowerDesc.includes('retaining ring') ||
		lowerDesc.includes('snap ring') ||
		lowerDesc.includes('circlip')
	) {
		return HardwareType.RING;
	}
	// Pin check - be specific to avoid matching "tapping" or other words containing "pin"
	if (
		lowerDesc.includes('dowel pin') ||
		lowerDesc.includes('cotter pin') ||
		lowerDesc.includes('spring pin') ||
		lowerDesc.includes('clevis pin') ||
		(lowerDesc.includes('pin') &&
			!lowerDesc.includes('tapping') &&
			!lowerDesc.includes('shopping') &&
			!lowerDesc.includes('pinion'))
	) {
		return HardwareType.PIN;
	}
	if (lowerDesc.includes('rivet')) {
		return HardwareType.RIVET;
	}
	if (lowerDesc.includes('bolt') || (lowerDesc.includes('hex') && lowerDesc.includes('head'))) {
		return HardwareType.BOLT;
	}
	if (lowerDesc.includes('screw') || lowerDesc.includes('socket')) {
		return HardwareType.SCREW;
	}

	// Default to OTHER (which requires length)
	return HardwareType.OTHER;
}

/**
 * Check if hardware type requires length input
 * @param {string} hardwareType - The hardware type
 * @returns {boolean} True if length is required
 */
function requiresLength(hardwareType) {
	// Types that DON'T require length: NUT, WASHER, RING
	return (
		hardwareType !== HardwareType.NUT &&
		hardwareType !== HardwareType.WASHER &&
		hardwareType !== HardwareType.RING
	);
}

export { HardwareType, getHardwareType, requiresLength };
