/**
 * Hardware Type Mappings
 *
 * Maps DIN/ISO standard numbers to hardware types for automatic categorization.
 * Inspired by McMaster-Carr's practical fastener categorization approach.
 * Used by build-all-standards.js to assign hardwareType to each standard.
 *
 * Hardware type affects UI behavior:
 * - Thread designation: SCREW uses "M" prefix (M5, M6), SELF_TAPPING strips it (5, 6)
 * - Length field: Required for SCREW, SELF_TAPPING, PIN, RIVET; hidden for NUT, WASHER, RING
 *
 * @see src/lib/utils/label-formatter.ts - formatThreadDesignation() for M prefix handling
 * @see src/lib/data/standards.ts - HardwareType enum (must stay in sync)
 */

// Hardware type enum (matches TypeScript enum in src/lib/data/standards.ts)
const HardwareType = {
	// ISO metric thread (M prefix): hex bolts, socket screws, machine screws, etc.
	SCREW: 'screw',
	// Self-tapping/drilling thread (no M prefix): creates own thread in material
	// Includes: wood screws, sheet metal screws, tapping screws, drilling screws
	SELF_TAPPING: 'self_tapping',
	NUT: 'nut',
	WASHER: 'washer',
	PIN: 'pin',
	RING: 'ring', // Retaining rings, snap rings, circlips
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
		din: [
			'917',
			'934',
			'935',
			'936',
			'937',
			'985',
			'986',
			'1587',
			'6923',
			'6924',
			'6925',
			'6926',
			'6927'
		],
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
			'6917',
			'9021'
		],
		iso: ['7089', '7090', '7091', '7092', '7093', '7094', '10643', '10644']
	},

	// SCREWS - ISO metric thread with "M" prefix (e.g., M5, M6×0.75, M8×1.25)
	// Includes: hex bolts, socket screws, countersunk, pan head, machine screws, etc.
	screws: {
		type: HardwareType.SCREW,
		din: [
			// Socket head cap screws
			'912',
			'913',
			'914',
			'915',
			'916',
			'6912',
			// Countersunk, pan head, etc.
			'963',
			'964',
			'965',
			'966',
			'967',
			'7984',
			'7985',
			'7988',
			'7991',
			// Hex head bolts
			'444',
			'558',
			'561',
			'601',
			'603',
			'604',
			'605',
			'607',
			'608',
			'609',
			'610',
			'931',
			'933',
			'960',
			'961',
			'7968', // Hexagon fit bolts with hexagon nut
			'7969', // Slotted countersunk head bolts with hexagon nut
			'7990' // Hexagon head bolts with hexagon nut
		],
		iso: [
			// Socket head cap screws
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
			'14580',
			// Hex head bolts
			'4014',
			'4016',
			'4017',
			'4018',
			'8676',
			'8765'
		]
	},

	// SELF-TAPPING SCREWS (wood screws, tapping screws, drilling screws)
	// Thread designation: nominal diameter without "M" prefix (e.g., 4.2, 4.8, 5.5 or ST4.2)
	selfTapping: {
		type: HardwareType.SELF_TAPPING,
		// Self-tapping, self-drilling, sheet metal screws - thread cuts into material
		din: ['95', '96', '97', '571', '7971', '7972', '7973', '7976', '7981', '7982', '7983', '7997'],
		iso: [
			'1479', // Hexagon head tapping screws
			'1481', // Slotted pan head tapping screws
			'1482', // Slotted countersunk head tapping screws
			'1483', // Slotted raised countersunk head tapping screws
			'7049', // Cross-recessed pan head tapping screws
			'7050', // Cross-recessed countersunk head tapping screws
			'7051', // Cross-recessed raised countersunk head tapping screws
			'7053', // Hexagon washer head tapping screws
			'15480', // Hexagon washer head drilling screws
			'15481', // Cross recessed pan head drilling screws
			'15482' // Cross recessed countersunk head drilling screws
		]
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
	// Check for self-tapping / tapping screws before general screws
	if (
		lowerDesc.includes('wood screw') ||
		lowerDesc.includes('tapping screw') ||
		lowerDesc.includes('self-tapping') ||
		lowerDesc.includes('drilling screw') ||
		lowerDesc.includes('thread cutting') ||
		lowerDesc.includes('thread forming')
	) {
		return HardwareType.SELF_TAPPING;
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
	// All metric thread fasteners (bolts, screws, socket head, etc.)
	if (
		lowerDesc.includes('bolt') ||
		lowerDesc.includes('screw') ||
		lowerDesc.includes('socket') ||
		(lowerDesc.includes('hex') && lowerDesc.includes('head'))
	) {
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
	// All others (SCREW, SELF_TAPPING, PIN, RIVET, OTHER) require length
	return (
		hardwareType !== HardwareType.NUT &&
		hardwareType !== HardwareType.WASHER &&
		hardwareType !== HardwareType.RING
	);
}

export { HardwareType, getHardwareType, requiresLength };
