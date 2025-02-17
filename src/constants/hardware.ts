export const metricThreadSizes = [
    "M1.4", "M1.6", "M2", "M2.5", "M3", "M4", "M5", "M6", "M8", "M10", "M12", "M16", "M20"
];

export const imperialThreadSizes = [
    "#4", "#6", "#8", "#10", "1/4″", "5/16″", "3/8″", "1/2″", "5/8″"
];

type StandardType = 'DIN' | 'ISO';
type HardwareFolder = 'screws' | 'nuts' | 'washers';

interface Standard {
    type: StandardType;
    number: string;
    description: string;
    folder: HardwareFolder;
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
    folder
});

const getStandardText = (standard: Standard) =>
    `${standard.type} ${standard.number} - ${standard.description}`;

const getStandardValue = (standard: Standard) =>
    `${standard.type} ${standard.number}`;

const getStandardImage = (standard: Standard) =>
    `/${standard.folder}/${standard.type.toLowerCase()}_${standard.number}.svg`;

const standards = {
    screw: [
        createStandard('DIN', '912', 'Socket Head Cap Screw', 'screws'),
        createStandard('DIN', '931', 'Hex Head Bolt (Partially Threaded)', 'screws'),
        createStandard('DIN', '933', 'Hex Head Bolt (Fully Threaded)', 'screws'),
        createStandard('DIN', '84', 'Slotted Cheese Head Screw', 'screws'),
        createStandard('DIN', '85', 'Slotted Pan Head Screw', 'screws'),
        createStandard('DIN', '963', 'Slotted Countersunk Screw', 'screws'),
        createStandard('DIN', '965', 'Phillips Countersunk Screw', 'screws'),
        createStandard('DIN', '966', 'Phillips Raised Countersunk Screw', 'screws'),
        createStandard('DIN', '7991', 'Hex Socket Countersunk Screw', 'screws'),
        createStandard('DIN', '7984', 'Low Head Socket Screw', 'screws'),
        createStandard('DIN', '571', 'Coach Screw (Wood Screw)', 'screws'),
        createStandard('DIN', '7985', 'Phillips Pan Head Screw', 'screws'),
        createStandard('DIN', '6921', 'Hex Flange Bolt', 'screws'),
        createStandard('DIN', '580', 'Lifting Eye Bolt', 'screws'),
        createStandard('DIN', '316', 'Wing Screw', 'screws'),
        createStandard('DIN', '7380', 'Hex Socket Button Head Screw', 'screws'),
        createStandard('DIN', '603', 'Mushroom Head', 'screws')
    ],
    nut: [
        createStandard('DIN', '934', 'Hex Nut', 'nuts'),
        createStandard('DIN', '985', 'Nylon Insert Lock Nut', 'nuts'),
        createStandard('DIN', '439', 'Thin Hex Nut', 'nuts'),
        createStandard('DIN', '936', 'Low Hex Nut', 'nuts'),
        createStandard('DIN', '1587', 'Domed Cap Nut (High Form)', 'nuts'),
        createStandard('DIN', '6923', 'Hex Flange Nut', 'nuts'),
        createStandard('DIN', '917', 'Low Domed Cap Nut', 'nuts'),
        createStandard('DIN', '928', 'Square Weld Nut', 'nuts'),
        createStandard('DIN', '929', 'Hex Weld Nut', 'nuts')
    ],
    washer: [
        createStandard('DIN', '125', 'Flat Washer', 'washers'),
        createStandard('DIN', '127', 'Split Lock Washer', 'washers'),
        createStandard('DIN', '9021', 'Large Flat Washer', 'washers'),
        createStandard('DIN', '433', 'Reduced Outer Diameter Washer', 'washers'),
        createStandard('DIN', '7349', 'Thick Flat Washer', 'washers'),
        createStandard('DIN', '6916', 'HV Washer (Structural Bolting)', 'washers'),
        createStandard('DIN', '6796', 'Conical Spring Washer (Belleville)', 'washers'),
        createStandard('DIN', '137A', 'Curved Spring Washer', 'washers'),
        createStandard('DIN', '137B', 'Wave Spring Washer', 'washers'),
        createStandard('DIN', '7980', 'Spring Lock Washer for Socket Screws', 'washers')
    ]
} as const;

export const dinStandards = {
    screw: standards.screw.map(std => ({
        value: getStandardValue(std),
        text: getStandardText(std),
        image: getStandardImage(std)
    })),
    nut: standards.nut.map(std => ({
        value: getStandardValue(std),
        text: getStandardText(std),
        image: getStandardImage(std)
    })),
    washer: standards.washer.map(std => ({
        value: getStandardValue(std),
        text: getStandardText(std),
        image: getStandardImage(std)
    }))
} as const;

export type HardwareType = keyof typeof dinStandards;