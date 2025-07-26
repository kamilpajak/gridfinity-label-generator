/**
 * ISO/DIN Standards Data
 * 
 * This file contains the master list of all hardware standards supported by the Gridfinity Label Generator.
 * Each standard includes its designation, description, and applicable hardware types.
 * 
 * Purpose:
 * - Central repository for all ISO/DIN standard definitions
 * - Type-safe data structure ensuring consistency across the application
 * - Enables filtering standards by hardware type (screw, bolt, nut, washer)
 * - Supports quick lookup and selection in the UI
 * 
 * Usage:
 * - Import this data into components that need to display or select standards
 * - Filter by hardwareTypes to show only relevant standards
 * - Images referenced here should be placed in /static/images/standards/
 */

/**
 * Interface defining the structure of an ISO/DIN standard
 */
export interface ISODINStandard {
  /** Unique identifier for the standard */
  id: string;
  
  /** Human-readable description of the standard */
  description: string;
  
  /** All standard designations (ISO, DIN, ANSI/ASME, PN, etc.) */
  designations: Array<{
    system: 'ISO' | 'DIN' | 'ANSI' | 'ASME' | 'PN' | 'GB' | 'JIS';
    code: string;
  }>;
  
  /** Hardware types this standard applies to */
  hardwareTypes: ('screw' | 'bolt' | 'nut' | 'washer')[];
  
  /** Path to visual representation (relative to /static/) */
  image?: string;
  
  /** Category for grouping similar standards */
  category?: 'socket' | 'countersunk' | 'set' | 'hex' | 'flat' | 'pan' | 'button';
}

/**
 * Master list of all supported ISO/DIN standards
 */
export const standards: ISODINStandard[] = [
  {
    id: 'iso4762',
    description: 'Socket Head Cap Screw',
    designations: [
      { system: 'ISO', code: '4762' },
      { system: 'DIN', code: '912' },
      { system: 'ANSI', code: 'B18.3' },
      { system: 'PN', code: '82005' }
    ],
    hardwareTypes: ['screw', 'bolt'],
    category: 'socket',
    image: '/images/standards/iso4762.png'
  },
  {
    id: 'iso4032',
    description: 'Hex Nut',
    designations: [
      { system: 'ISO', code: '4032' },
      { system: 'DIN', code: '934' },
      { system: 'ANSI', code: 'B18.2.2' },
      { system: 'PN', code: '82144' }
    ],
    hardwareTypes: ['nut'],
    category: 'hex'
  },
  {
    id: 'iso10642',
    description: 'Countersunk Head Screw',
    designations: [
      { system: 'ISO', code: '10642' },
      { system: 'DIN', code: '7991' },
      { system: 'ANSI', code: 'B18.3.2' },
      { system: 'PN', code: '82009' }
    ],
    hardwareTypes: ['screw', 'bolt'],
    category: 'countersunk'
  },
  {
    id: 'iso7089',
    description: 'Plain Washer',
    designations: [
      { system: 'ISO', code: '7089' },
      { system: 'DIN', code: '125' },
      { system: 'ANSI', code: 'B18.22.1' },
      { system: 'PN', code: '82005' }
    ],
    hardwareTypes: ['washer'],
    category: 'flat'
  },
  {
    id: 'iso4026',
    description: 'Set Screw with Flat Point',
    designations: [
      { system: 'ISO', code: '4026' },
      { system: 'DIN', code: '913' },
      { system: 'ANSI', code: 'B18.3.6M' }
    ],
    hardwareTypes: ['screw'],
    category: 'set'
  },
  {
    id: 'iso14579',
    description: 'Hexalobular Socket Head Screw',
    designations: [
      { system: 'ISO', code: '14579' },
      { system: 'DIN', code: '34822' }
    ],
    hardwareTypes: ['screw', 'bolt'],
    category: 'socket'
  },
  {
    id: 'iso4035',
    description: 'Hex Thin Nut',
    designations: [
      { system: 'ISO', code: '4035' },
      { system: 'DIN', code: '439' },
      { system: 'ANSI', code: 'B18.2.2' }
    ],
    hardwareTypes: ['nut'],
    category: 'hex'
  },
  {
    id: 'iso7380',
    description: 'Button Head Socket Screw',
    designations: [
      { system: 'ISO', code: '7380' },
      { system: 'DIN', code: '9427' }
    ],
    hardwareTypes: ['screw', 'bolt'],
    category: 'button'
  }
];

/**
 * Type definitions for filtering and categorization
 */
export type HardwareType = ISODINStandard['hardwareTypes'][number];

/**
 * Default standard to use when none is selected
 */
export const DEFAULT_STANDARD_ID = 'iso4762';

/**
 * Search for standards by any designation code or description
 * @param query - The search query (can be ISO, DIN, ANSI, PN code or description)
 * @param hardwareType - Optional filter by hardware type
 * @returns Array of matching standards
 */
export function searchStandards(
  query: string, 
  hardwareType?: HardwareType
): ISODINStandard[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  return standards.filter(std => {
    // Filter by hardware type if specified
    if (hardwareType && !std.hardwareTypes.includes(hardwareType)) {
      return false;
    }
    
    // Search in all designation codes
    const matchesDesignation = std.designations.some(des => 
      des.code.toLowerCase().includes(normalizedQuery)
    );
    
    // Search in description
    const matchesDescription = std.description.toLowerCase().includes(normalizedQuery);
    
    // Search in the combined designation string (e.g., "ISO 4762", "DIN 912")
    const matchesFullDesignation = std.designations.some(des => 
      `${des.system} ${des.code}`.toLowerCase().includes(normalizedQuery)
    );
    
    return matchesDesignation || matchesDescription || matchesFullDesignation;
  });
}

/**
 * Get a formatted string of all designations for a standard
 * @param standard - The standard to format
 * @returns Formatted string like "ISO 4762 / DIN 912 / ANSI B18.3"
 */
export function formatDesignations(standard: ISODINStandard): string {
  return standard.designations
    .map(d => `${d.system} ${d.code}`)
    .join(' / ');
}