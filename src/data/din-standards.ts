export interface DINStandard {
    value: string;
    text: string;
}

export interface DINStandards {
    screw: DINStandard[];
    nut: DINStandard[];
    washer: DINStandard[];
}

export const dinStandards: DINStandards = {
    screw: [
        {value: "DIN 912", text: "DIN 912 - Socket Head Cap Screw"},
        {value: "DIN 931", text: "DIN 931 - Hex Head Bolt (Partially Threaded)"},
        {value: "DIN 933", text: "DIN 933 - Hex Head Bolt (Fully Threaded)"},
        {value: "DIN 84", text: "DIN 84 - Slotted Cheese Head Screw"},
        {value: "DIN 85", text: "DIN 85 - Slotted Pan Head Screw"},
        {value: "DIN 963", text: "DIN 963 - Slotted Countersunk Screw"},
        {value: "DIN 965", text: "DIN 965 - Phillips Countersunk Screw"},
        {value: "DIN 966", text: "DIN 966 - Phillips Raised Countersunk Screw"},
        {value: "DIN 7991", text: "DIN 7991 - Hex Socket Countersunk Screw"},
        {value: "DIN 7984", text: "DIN 7984 - Low Head Socket Screw"},
        {value: "DIN 571", text: "DIN 571 - Coach Screw (Wood Screw)"},
        {value: "DIN 7985", text: "DIN 7985 - Phillips Pan Head Screw"},
        {value: "DIN 6921", text: "DIN 6921 - Hex Flange Bolt"},
        {value: "DIN 580", text: "DIN 580 - Lifting Eye Bolt"},
        {value: "DIN 316", text: "DIN 316 - Wing Screw"},
        {value: "DIN 7380", text: "DIN 7380 - Hex Socket Button Head Screw"},
        {value: "DIN 603", text: "DIN 603 - Mushroom Head"},
    ],
    nut: [
        {value: "DIN 934", text: "DIN 934 - Hex Nut"},
        {value: "DIN 985", text: "DIN 985 - Nylon Insert Lock Nut"},
        {value: "DIN 439", text: "DIN 439 - Thin Hex Nut"},
        {value: "DIN 936", text: "DIN 936 - Low Hex Nut"},
        {value: "DIN 1587", text: "DIN 1587 - Domed Cap Nut (High Form)"},
        {value: "DIN 6923", text: "DIN 6923 - Hex Flange Nut"},
        {value: "DIN 917", text: "DIN 917 - Low Domed Cap Nut"},
        {value: "DIN 928", text: "DIN 928 - Square Weld Nut"},
        {value: "DIN 929", text: "DIN 929 - Hex Weld Nut"},
    ],
    washer: [
        {value: "DIN 125", text: "DIN 125 - Flat Washer"},
        {value: "DIN 127", text: "DIN 127 - Split Lock Washer"},
        {value: "DIN 9021", text: "DIN 9021 - Large Flat Washer"},
        {value: "DIN 433", text: "DIN 433 - Reduced Outer Diameter Washer"},
        {value: "DIN 7349", text: "DIN 7349 - Thick Flat Washer"},
        {value: "DIN 6916", text: "DIN 6916 - HV Washer (Structural Bolting)"},
        {value: "DIN 6796", text: "DIN 6796 - Conical Spring Washer (Belleville)"},
        {value: "DIN 137A", text: "DIN 137A - Curved Spring Washer"},
        {value: "DIN 137B", text: "DIN 137B - Wave Spring Washer"},
        {value: "DIN 7980", text: "DIN 7980 - Spring Lock Washer for Socket Screws"},
    ],
};
