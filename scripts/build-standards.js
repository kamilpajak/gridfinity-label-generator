#!/usr/bin/env node

/**
 * Standards Data Builder
 * 
 * This script merges processed ISO standards with cross-reference mappings to create
 * a comprehensive standards dataset with multi-designation support (ISO/DIN/ANSI/PN).
 * 
 * Purpose:
 * - Merge ISO standards with DIN/ANSI/PN cross-references
 * - Categorize standards based on description keywords
 * - Filter to priority standards for optimal client-side performance
 * - Generate TypeScript module with proper typing
 * 
 * Data Pipeline:
 *   1. process-iso-data.js → standards-processed.json (146 ISO standards)
 *   2. Manual curation → standards-crossref.json (designation mappings)
 *   3. build-standards.js → standards-generated.ts (40 priority standards)
 * 
 * Usage:
 *   npm run build-standards
 *   # or
 *   node scripts/build-standards.js
 * 
 * Input:
 *   src/lib/data/standards-processed.json - ISO standards from process-iso-data.js
 *   data/standards-crossref.json - Manual cross-reference mappings
 * 
 * Output:
 *   src/lib/data/standards-generated.ts - TypeScript module with standards data
 * 
 * @requires Node.js 14+ (for ES modules)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Category mapping based on description keywords
// Used to automatically categorize standards by their head/drive type
const CATEGORY_KEYWORDS = {
  socket: ['socket', 'allen'],
  countersunk: ['countersunk', 'flat head', 'conical'],
  set: ['set screw', 'grub'],
  hex: ['hex', 'hexagon'],
  flat: ['flat', 'plain washer'],
  pan: ['pan head'],
  button: ['button head'],
  cheese: ['cheese head'],
  fillister: ['fillister'],
  round: ['round head'],
  carriage: ['carriage bolt', 'coach'],
  flange: ['flange'],
  square: ['square'],
  wing: ['wing', 'thumb'],
  weld: ['weld']
};

// Determine category from description
// Analyzes the standard description to automatically assign a category
// Returns undefined if no matching category is found
function determineCategory(description) {
  const lowerDesc = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return category;
    }
  }
  
  return undefined;
}

// Main build function
async function buildStandards() {
  // Input files
  const processedFile = path.join(__dirname, '..', 'src', 'lib', 'data', 'standards-processed.json');
  const crossrefFile = path.join(__dirname, '..', 'data', 'standards-crossref.json');
  const outputFile = path.join(__dirname, '..', 'src', 'lib', 'data', 'standards-generated.ts');
  
  // Read input files
  const processedData = JSON.parse(fs.readFileSync(processedFile, 'utf8'));
  const crossrefData = JSON.parse(fs.readFileSync(crossrefFile, 'utf8'));
  
  console.log(`Processing ${processedData.standards.length} standards...`);
  
  // Process each standard
  const standards = processedData.standards.map(std => {
    const crossref = crossrefData[std.id] || {};
    
    // Build designations array
    const designations = [
      { system: 'ISO', code: std.designations[0].code }
    ];
    
    // Add DIN designations
    if (crossref.din) {
      const dinCodes = Array.isArray(crossref.din) ? crossref.din : [crossref.din];
      dinCodes.forEach(code => {
        designations.push({ system: 'DIN', code: String(code) });
      });
    }
    
    // Add ANSI designations
    if (crossref.ansi) {
      const ansiCodes = Array.isArray(crossref.ansi) ? crossref.ansi : [crossref.ansi];
      ansiCodes.forEach(code => {
        designations.push({ system: 'ANSI', code: String(code) });
      });
    }
    
    // Add PN designations
    if (crossref.pn) {
      const pnCodes = Array.isArray(crossref.pn) ? crossref.pn : [crossref.pn];
      pnCodes.forEach(code => {
        designations.push({ system: 'PN', code: String(code) });
      });
    }
    
    // Build the standard object
    const standard = {
      id: std.id,
      description: crossref.description || std.description,
      designations,
      hardwareTypes: std.hardwareTypes
    };
    
    // Add optional fields
    const category = determineCategory(std.description);
    if (category) standard.category = category;
    
    if (std.icsCode) standard.icsCode = std.icsCode;
    if (std.reference) standard.reference = std.reference;
    
    // Scope is omitted to reduce file size
    // Uncomment below to include scope in output
    // if (std.scope && std.scope.length < 200) {
    //   standard.scope = std.scope.replace(/<[^>]*>/g, '').trim(); // Remove HTML tags
    // }
    
    return standard;
  });
  
  // Filter to most common standards
  // This reduces the client-side bundle from 146 to 40 standards
  // Includes the most commonly used fastener standards
  // To include all standards, comment out the filter below
  const priorityStandards = [
    'iso225', 'iso273', 'iso887', 'iso898',     // General standards
    'iso1207', 'iso1234', 'iso1478', 'iso1479', // Basic screws and pins
    'iso1580', 'iso2009', 'iso2010', 'iso2342', // Slotted screws
    'iso3266', 'iso3506', 'iso4014', 'iso4016', // Hex bolts
    'iso4017', 'iso4018', 'iso4026', 'iso4027', // Hex screws and set screws
    'iso4028', 'iso4029', 'iso4032', 'iso4033', // Set screws and nuts
    'iso4034', 'iso4035', 'iso4036', 'iso4762', // Nuts and socket screws
    'iso7040', 'iso7045', 'iso7046', 'iso7047', // Self-locking and cross-recessed
    'iso7048', 'iso7049', 'iso7089', 'iso7090', // Tapping screws and washers
    'iso7091', 'iso7092', 'iso7093', 'iso7094', // Various washers
    'iso7380', 'iso8676', 'iso8765', 'iso10642', // Button head and fine thread
    'iso14579', 'iso14580', 'iso14581', 'iso14582' // Hexalobular (Torx)
  ];
  
  // Include all standards (no filtering)
  // To use priority filtering, uncomment the filter below
  const filteredStandards = standards
    // .filter(std => priorityStandards.includes(std.id))
    .sort((a, b) => {
      // Sort by ISO number for consistent ordering
      const aNum = parseInt(a.designations[0].code);
      const bNum = parseInt(b.designations[0].code);
      return aNum - bNum;
    });
  
  // Generate TypeScript file with proper formatting
  // Replaces quoted property names with unquoted for cleaner output
  // Maintains const assertion for type safety
  const tsContent = `/**
 * GENERATED FILE - DO NOT EDIT
 * 
 * This file is automatically generated by scripts/build-standards.js
 * To update, modify the source data and run: npm run build-standards
 * 
 * Generated: ${new Date().toISOString()}
 * Source standards: ${processedData.standards.length}
 * Output standards: ${filteredStandards.length}
 */

import type { ISODINStandard } from './standards';

/**
 * Generated list of fastener standards with cross-references
 */
export const generatedStandards: ISODINStandard[] = ${JSON.stringify(filteredStandards, null, 2)
  .replace(/"system":/g, 'system:')
  .replace(/"code":/g, 'code:')
  .replace(/"id":/g, 'id:')
  .replace(/"description":/g, 'description:')
  .replace(/"designations":/g, 'designations:')
  .replace(/"hardwareTypes":/g, 'hardwareTypes:')
  .replace(/"category":/g, 'category:')
  .replace(/"icsCode":/g, 'icsCode:')
  .replace(/"reference":/g, 'reference:')
  .replace(/"scope":/g, 'scope:')
  .replace(/"(ISO|DIN|ANSI|PN)":/g, '$1:')
  .replace(/"(screw|bolt|nut|washer|pin|rivet|clamp|spring|fastener)":/g, '$1')
  .replace(/"(socket|countersunk|set|hex|flat|pan|button|cheese|fillister|round|carriage|flange|square|wing|weld)":/g, '$1')
} as const;

/**
 * Get all unique hardware types from generated standards
 */
export const hardwareTypes = Array.from(
  new Set(generatedStandards.flatMap(s => s.hardwareTypes))
).sort();

/**
 * Get all unique categories from generated standards
 */
export const categories = Array.from(
  new Set(generatedStandards.map(s => s.category).filter(Boolean))
).sort();
`;
  
  // Write output file
  fs.writeFileSync(outputFile, tsContent);
  
  console.log(`\nBuild complete!`);
  console.log(`Input standards: ${processedData.standards.length}`);
  console.log(`Cross-references found: ${Object.keys(crossrefData).length}`);
  console.log(`Output standards: ${filteredStandards.length}`);
  console.log(`Output file: ${outputFile}`);
}

// Run the build
buildStandards().catch(console.error);