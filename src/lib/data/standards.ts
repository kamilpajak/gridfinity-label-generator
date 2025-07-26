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
  hardwareTypes: ('screw' | 'bolt' | 'nut' | 'washer' | 'pin' | 'rivet' | 'clamp' | 'spring' | 'fastener')[];
  
  /** Path to visual representation (relative to /static/) */
  image?: string;
  
  /** Category for grouping similar standards */
  category?: 'socket' | 'countersunk' | 'set' | 'hex' | 'flat' | 'pan' | 'button' | 'cheese' | 'fillister' | 'round' | 'truss' | 'binding' | 'thumb' | 'wing' | 'square' | 'carriage' | 'flange' | 'weld' | 'special';
  
  /** ICS (International Classification for Standards) codes */
  icsCode?: string[];
  
  /** ISO reference (e.g., "ISO 4762:2004") */
  reference?: string;
  
  /** Brief scope description */
  scope?: string;
}

/**
 * Import generated standards
 */
import { generatedStandards } from './standards-generated';

/**
 * Main standards array - generated from build pipeline
 */
export const standards = generatedStandards;

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