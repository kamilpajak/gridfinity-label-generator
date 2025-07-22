// Screw subtypes
export type ScrewSubtype = 'Bolt' | 'Screw'

export const screwSubtypes = [
  { value: 'Bolt', text: 'Bolt' },
  { value: 'Screw', text: 'Screw' },
]

// Bolt thread sizes
export const metricThreadSizes = [
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
  'M20',
]

export const imperialThreadSizes = [
  '#4',
  '#6',
  '#8',
  '#10',
  '1/4″',
  '5/16″',
  '3/8″',
  '1/2″',
  '5/8″',
]

// Screw sizes
export const screwMetricSizes = ['2mm', '3mm', '3.5mm', '4mm', '4.5mm', '5mm', '6mm', '8mm', '10mm']

export const screwImperialSizes = ['#4', '#6', '#8', '#10', '#12', '#14', '1/4″', '5/16″']

type StandardType = 'DIN' | 'ISO'
type HardwareFolder = 'screws' | 'nuts' | 'washers'

interface Standard {
  type: StandardType
  number: string
  description: string
  folder: HardwareFolder
}

const createStandard = (
  type: StandardType,
  number: string,
  description: string,
  folder: HardwareFolder
): Standard => ({
  type,
  number,
  description,
  folder,
})

const getStandardText = (standard: Standard) =>
  `${standard.type} ${standard.number} - ${standard.description}`

const getStandardValue = (standard: Standard) => `${standard.type} ${standard.number}`

const getStandardImage = (standard: Standard) =>
  `/${standard.folder}/${standard.type.toLowerCase()}_${standard.number}.svg`

/**
 * Transforms a Standard object into a formatted option for dropdowns
 * @param {Standard} standard - The standard to transform
 * @returns {Object} Formatted option with value, text, and image properties
 */
const transformStandardToOption = (standard: Standard) => ({
  value: getStandardValue(standard),
  text: getStandardText(standard),
  image: getStandardImage(standard),
})

const standards = {
  screw: [
    createStandard('DIN', '11014', 'Hexagon Head Screw', 'screws'),
    createStandard('DIN', '15237', 'Slotted Raised Countersunk Head Screw', 'screws'),
    createStandard('DIN', '186', 'Square Head Bolt', 'screws'),
    createStandard('DIN', '21346', 'Slotted Pan Head Screw', 'screws'),
    createStandard('DIN', '22424', 'Slotted Pan Head Screw', 'screws'),
    // createStandard("DIN", "2510", "T-Head Bolt", "screws"),
    createStandard('DIN', '25193', 'Slotted Pan Head Screw', 'screws'),
    createStandard('DIN', '261', 'Hexagon Head Screw', 'screws'),
    createStandard('DIN', '316', 'Wing Screw', 'screws'),
    createStandard('DIN', '34817', 'Pan Head Screw', 'screws'),
    createStandard('DIN', '404', 'Square Head Set Screw', 'screws'),
    createStandard('DIN', '444', 'Eye Bolt with Collar', 'screws'),
    createStandard('DIN', '464', 'Knurled Thumb Screw', 'screws'),
    createStandard('DIN', '478', 'Knurled Head Screw', 'screws'),
    createStandard('DIN', '479', 'Knurled Head Screw with Shoulder', 'screws'),
    createStandard('DIN', '480', 'Slotted Knurled Head Screw', 'screws'),
    createStandard('DIN', '561', 'Square Head Set Screw', 'screws'),
    createStandard('DIN', '564', 'Slotted Set Screw with Long Dog Point', 'screws'),
    createStandard('DIN', '571', 'Coach Screw (Wood Screw)', 'screws'),
    createStandard('DIN', '580', 'Lifting Eye Bolt', 'screws'),
    createStandard('DIN', '5903', 'Slotted Pan Head Screw', 'screws'),
    createStandard('DIN', '603', 'Mushroom Head Square Neck Bolt', 'screws'),
    createStandard('DIN', '604', 'Square Head Bolt with Square Neck', 'screws'),
    createStandard('DIN', '605', 'Square Head Bolt with Round Neck', 'screws'),
    createStandard('DIN', '607', 'Round Head Square Neck Bolt', 'screws'),
    createStandard('DIN', '608', 'Round Head Square Neck Bolt', 'screws'),
    createStandard('DIN', '609', 'Fit Bolt with Hexagon Head', 'screws'),
    createStandard('DIN', '610', 'Fit Bolt with Round Head', 'screws'),
    createStandard('DIN', '653', 'Recessed Head Screw', 'screws'),
    createStandard('DIN', '6912', 'Hexagon Socket Head Cap Screw with Low Head', 'screws'),
    createStandard('DIN', '6914', 'High-Strength Hexagon Head Bolt', 'screws'),
    createStandard('DIN', '6921', 'Hexagon Flange Head Bolt', 'screws'),
    createStandard('DIN', '787', 'Round Head Screw with Square Neck', 'screws'),
    createStandard('DIN', '792', 'Square Head Bolt with Square Shoulder', 'screws'),
    createStandard('DIN', '7968', 'Hexagon Fit Bolt', 'screws'),
    createStandard('DIN', '7969', 'Hexagon Head Bolt with Hexagon Collar', 'screws'),
    createStandard('DIN', '7984', 'Hexagon Socket Head Cap Screw with Low Head', 'screws'),
    createStandard('DIN', '7990', 'Hexagon Head Bolt for Steel Structures', 'screws'),
    createStandard('DIN', '7991', 'Hexagon Socket Countersunk Head Cap Screw', 'screws'),
    createStandard('DIN', '7995', 'Cross Recessed Pan Head Wood Screw', 'screws'),
    createStandard('DIN', '7996', 'Cross Recessed Countersunk Head Wood Screw', 'screws'),
    createStandard('DIN', '7997', 'Cross Recessed Raised Countersunk Head Wood Screw', 'screws'),
    createStandard('DIN', '7999', 'Cross Recessed Pan Head Tapping Screw', 'screws'),
    createStandard('DIN', '912', 'Hexagon Socket Head Cap Screw', 'screws'),
    createStandard('DIN', '931', 'Hexagon Head Bolt', 'screws'),
    createStandard('DIN', '933', 'Hexagon Head Screw', 'screws'),
    createStandard('DIN', '95', 'Round Head Wood Screw', 'screws'),
    createStandard('DIN', '96', 'Raised Countersunk Head Wood Screw', 'screws'),
    createStandard('DIN', '960', 'Hexagon Head Fit Bolt', 'screws'),
    createStandard('DIN', '961', 'Hexagon Head Fit Bolt', 'screws'),
    createStandard('DIN', '97', 'Countersunk Head Wood Screw', 'screws'),
    createStandard('ISO', '7379', 'Hexagon Socket Head Shoulder Screw', 'screws'),
    createStandard('ISO', '7380-1', 'Button Head Screw', 'screws'),
    createStandard('ISO', '7380-2', 'Button Head Screw with Collar', 'screws'),
  ],
  nut: [
    createStandard('DIN', '1478', 'Wing Nut', 'nuts'),
    createStandard('DIN', '1479', 'Wing Nut', 'nuts'),
    createStandard('DIN', '1480', 'Wing Nut', 'nuts'),
    createStandard('DIN', '1587', 'Cap Nut', 'nuts'),
    createStandard('DIN', '1804', 'Slotted Round Nut', 'nuts'),
    createStandard('DIN', '1816', 'Square Weld Nut', 'nuts'),
    // createStandard("DIN", "2510", "T-Slot Nut", "nuts"),
    createStandard('DIN', '315', 'Wing Nut', 'nuts'),
    createStandard('DIN', '431', 'Square Nut', 'nuts'),
    createStandard('DIN', '439', 'Hexagon Thin Nut', 'nuts'),
    createStandard('DIN', '466', 'Square Nut', 'nuts'),
    createStandard('DIN', '467', 'Knurled Nut', 'nuts'),
    createStandard('DIN', '508', 'T-Slot Nut', 'nuts'),
    createStandard('DIN', '546', 'Small Hexagon Nut', 'nuts'),
    createStandard('DIN', '557', 'Square Nut', 'nuts'),
    createStandard('DIN', '562', 'Square Thin Nut', 'nuts'),
    createStandard('DIN', '582', 'Eye Nut', 'nuts'),
    createStandard('DIN', '6330', 'Hexagon Nut', 'nuts'),
    createStandard('DIN', '6331', 'Hexagon High Nut', 'nuts'),
    createStandard('DIN', '6334', 'Hexagon High Nut', 'nuts'),
    createStandard('DIN', '6915', 'High-Strength Hexagon Nut', 'nuts'),
    createStandard('DIN', '6923', 'Hexagon Flange Nut', 'nuts'),
    createStandard('DIN', '6925', 'Hexagon Weld Nut', 'nuts'),
    createStandard('DIN', '6926', 'Prevailing Torque Type Hexagon Nut', 'nuts'),
    createStandard('DIN', '6927', 'Prevailing Torque Type Hexagon Thin Nut', 'nuts'),
    createStandard('DIN', '70852', 'Hexagon Nut with Flange', 'nuts'),
    createStandard('DIN', '74361', 'Hexagon Nut with Flange', 'nuts'),
    createStandard('DIN', '7965', 'Square Weld Nut', 'nuts'),
    createStandard('DIN', '7967', 'Prevailing Torque Type Hexagon Nut', 'nuts'),
    createStandard('DIN', '80701', 'Hexagon Nut', 'nuts'),
    createStandard('DIN', '80705', 'Hexagon Nut', 'nuts'),
    createStandard('DIN', '917', 'Cap Nut', 'nuts'),
    createStandard('DIN', '928', 'Hexagon Weld Nut', 'nuts'),
    createStandard('DIN', '929', 'Hexagon Weld Nut', 'nuts'),
    createStandard('DIN', '934', 'Hexagon Nut', 'nuts'),
    createStandard('DIN', '935', 'Castle Nut', 'nuts'),
    createStandard('DIN', '936', 'Hexagon Thin Nut', 'nuts'),
    createStandard('DIN', '937', 'Hexagon Thin Slotted Nut', 'nuts'),
    createStandard('DIN', '979', 'Hexagon Slotted Nut', 'nuts'),
    createStandard('DIN', '980', 'Prevailing Torque Type Hexagon Nut', 'nuts'),
    createStandard('DIN', '981', 'Slotted Round Nut', 'nuts'),
    createStandard('DIN', '982', 'Prevailing Torque Type Hexagon Nut', 'nuts'),
    createStandard('DIN', '985', 'Prevailing Torque Type Hexagon Nut', 'nuts'),
    createStandard('DIN', '986', 'Prevailing Torque Type Hexagon Thin Nut', 'nuts'),
    createStandard('ISO', '7040', 'Prevailing Torque Type Hexagon Nut', 'nuts'),
  ],
  washer: [
    createStandard('DIN', '1052', 'Washer for Wood Construction', 'washers'),
    createStandard('DIN', '125', 'Plain Washer', 'washers'),
    createStandard('DIN', '127', 'Spring Lock Washer', 'washers'),
    createStandard('DIN', '128', 'Spring Lock Washer', 'washers'),
    createStandard('DIN', '137', 'Spring Lock Washer', 'washers'),
    createStandard('DIN', '1440', 'Plain Washer', 'washers'),
    createStandard('DIN', '1441', 'Plain Washer', 'washers'),
    createStandard('DIN', '2093', 'Disc Spring', 'washers'),
    createStandard('DIN', '25201', 'Wedge Lock Washer', 'washers'),
    createStandard('DIN', '432', 'Square Washer', 'washers'),
    createStandard('DIN', '433', 'Plain Washer', 'washers'),
    createStandard('DIN', '434', 'Square Taper Washer', 'washers'),
    createStandard('DIN', '435', 'Square Taper Washer', 'washers'),
    createStandard('DIN', '436', 'Square Washer', 'washers'),
    createStandard('DIN', '440', 'Plain Washer', 'washers'),
    createStandard('DIN', '462', 'Square Washer', 'washers'),
    createStandard('DIN', '463', 'Square Washer', 'washers'),
    createStandard('DIN', '5406', 'Tooth Lock Washer', 'washers'),
    createStandard('DIN', '6319', 'Spherical Washer', 'washers'),
    createStandard('DIN', '6340', 'Heavy Duty Plain Washer', 'washers'),
    createStandard('DIN', '6796', 'Conical Spring Washer', 'washers'),
    createStandard('DIN', '6797', 'Tooth Lock Washer', 'washers'),
    createStandard('DIN', '6798', 'Tooth Lock Washer', 'washers'),
    createStandard('DIN', '6916', 'High-Strength Structural Washer', 'washers'),
    createStandard('DIN', '6917', 'Square Taper Washer', 'washers'),
    createStandard('DIN', '6918', 'Square Taper Washer', 'washers'),
    createStandard('DIN', '70952', 'Plain Washer', 'washers'),
    createStandard('DIN', '7349', 'Heavy Duty Plain Washer', 'washers'),
    createStandard('DIN', '74361', 'Plain Washer', 'washers'),
    createStandard('DIN', '7603', 'Sealing Washer', 'washers'),
    createStandard('DIN', '7980', 'Spring Lock Washer', 'washers'),
    createStandard('DIN', '7989', 'Plain Washer', 'washers'),
    createStandard('DIN', '9021', 'Plain Washer', 'washers'),
    createStandard('DIN', '93', 'Tab Washer', 'washers'),
    createStandard('DIN', '988', 'Shim Ring', 'washers'),
  ],
} as const

// Helper function to identify screws (vs bolts)
const isScrew = (standard: Standard): boolean => {
  return (
    standard.description.toLowerCase().includes('wood screw') || standard.number === '571' // Coach Screw (Wood Screw)
  )
}

/**
 * Gets hardware standards filtered by screw subtype (Screw vs Bolt)
 * @param {ScrewSubtype} subtype - The screw subtype to filter by
 * @returns {Array} Array of formatted standard options
 */
export const getScrewStandardsBySubtype = (subtype: ScrewSubtype) => {
  if (subtype === 'Screw') {
    return standards.screw.filter(isScrew).map(transformStandardToOption)
  } else {
    // Bolt
    return standards.screw.filter(std => !isScrew(std)).map(transformStandardToOption)
  }
}

/**
 * Exported hardware standards formatted for UI dropdowns
 * @constant {Object} dinStandards
 * @property {Array} screw - All screw standards
 * @property {Array} nut - All nut standards
 * @property {Array} washer - All washer standards
 */
export const dinStandards = {
  screw: standards.screw.map(transformStandardToOption),
  nut: standards.nut.map(transformStandardToOption),
  washer: standards.washer.map(transformStandardToOption),
} as const

export type HardwareType = keyof typeof dinStandards
