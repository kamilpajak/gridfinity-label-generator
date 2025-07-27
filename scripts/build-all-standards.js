#!/usr/bin/env node

/**
 * Unified Standards Builder
 * 
 * This script processes all standards data in a single pipeline:
 * 1. Processes raw ISO data from JSONL
 * 2. Applies cross-references and mappings
 * 3. Includes DIN-only standards
 * 4. Generates final TypeScript module
 * 
 * Purpose:
 * - Single script for entire build process
 * - No intermediate files needed
 * - Processes everything in memory
 * 
 * Usage:
 *   npm run build-standards
 *   # or
 *   node scripts/build-all-standards.js
 * 
 * Input:
 *   data/raw/iso_deliverables_metadata.jsonl - Raw ISO standards data
 *   data/standards-config.json - All configurations (crossref, DIN-only, images)
 * 
 * Output:
 *   src/lib/data/standards-generated.ts - TypeScript module with all standards
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Process ISO data from JSONL
async function processISOData(filePath) {
  const standards = [];
  const seenIds = new Set(); // Track duplicates
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    if (!line.trim()) continue;
    
    try {
      const data = JSON.parse(line);
      
      // Skip non-fastener standards
      if (!data.icsCode || !data.icsCode.some(code => code.startsWith('21.060'))) {
        continue;
      }
      
      // Skip withdrawn standards (95+ codes)
      if (data.currentStage && data.currentStage >= 9500) {
        continue;
      }
      
      // Must be from TC 2 committee (fasteners)
      if (!data.ownerCommittee || 
          !(data.ownerCommittee === 'ISO/TC 2' || data.ownerCommittee.startsWith('ISO/TC 2/'))) {
        continue;
      }
      
      // Skip if replaced by another standard
      if (data.replacedBy && data.replacedBy.length > 0) {
        continue;
      }
      
      // Extract number from reference
      const match = data.reference.match(/ISO (\d+)/);
      if (!match) continue;
      
      const isoNumber = match[1];
      const id = `iso${isoNumber}`;
      
      // Skip duplicates (keep the first one)
      if (seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      
      // Create standard object
      standards.push({
        id,
        primarySystem: 'ISO',
        reference: data.reference,
        title: data.title?.en || data.title?.fr || '',
        icsCode: data.icsCode,
        scope: data.abstract?.en || data.abstract?.fr || ''
      });
    } catch (e) {
      // Skip invalid lines
    }
  }
  
  return standards;
}

// Main build function
async function buildStandards() {
  // Input files
  const isoDataFile = path.join(__dirname, '..', 'data', 'raw', 'iso_deliverables_metadata.jsonl');
  const configFile = path.join(__dirname, '..', 'data', 'standards-config.json');
  const outputFile = path.join(__dirname, '..', 'src', 'lib', 'data', 'standards-generated.ts');
  
  // Load configuration
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  
  console.log('📚 Processing ISO standards...');
  const isoStandards = await processISOData(isoDataFile);
  console.log(`   Found ${isoStandards.length} ISO standards`);
  
  // Process ISO standards with configurations
  const processedISO = isoStandards.map(std => {
    const crossref = config.crossref[std.id] || {};
    
    // Build designations array
    const designations = [
      { system: 'ISO', code: std.id.replace('iso', '') }
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
    
    // Build standard object
    const standard = {
      id: std.id,
      primarySystem: 'ISO',
      description: std.title,
      designations
    };
    
    // Add optional fields
    if (std.icsCode) standard.icsCode = std.icsCode;
    if (std.reference) standard.reference = std.reference;
    
    // Add image if mapping exists
    if (config.imageMappings[std.id]) {
      standard.image = config.imageMappings[std.id];
    }
    
    return standard;
  });
  
  console.log('🔩 Processing DIN-only standards...');
  
  // Process DIN-only standards
  const dinStandards = Object.entries(config.dinOnly).map(([id, dinConfig]) => {
    const dinNumber = id.replace('din', '');
    
    return {
      id,
      primarySystem: 'DIN',
      description: dinConfig.description,
      designations: [
        { system: 'DIN', code: dinNumber }
      ],
      image: `/images/standards/din_${dinNumber}.jpg`
    };
  });
  
  console.log(`   Found ${dinStandards.length} DIN-only standards`);
  
  // Combine all standards
  const allStandards = [...processedISO, ...dinStandards];
  
  // Sort standards
  const sortedStandards = allStandards.sort((a, b) => {
    // First sort by primary system (ISO before DIN)
    if (a.primarySystem !== b.primarySystem) {
      return a.primarySystem === 'ISO' ? -1 : 1;
    }
    
    // Then sort by number within each system
    const aCode = a.designations[0].code;
    const bCode = b.designations[0].code;
    const aNum = parseInt(aCode);
    const bNum = parseInt(bCode);
    return aNum - bNum;
  });
  
  // Count standards with images
  const standardsWithImages = sortedStandards.filter(s => s.image).length;
  
  // Generate TypeScript file
  const tsContent = `/**
 * GENERATED FILE - DO NOT EDIT
 * 
 * This file is automatically generated by scripts/build-all-standards.js
 * To update, modify the source data and run: npm run build-standards
 * 
 * Generated: ${new Date().toISOString()}
 * Total standards: ${sortedStandards.length}
 * ISO standards: ${processedISO.length}
 * DIN-only standards: ${dinStandards.length}
 * Standards with images: ${standardsWithImages}
 */

import type { ISODINStandard } from './standards';

/**
 * Generated list of fastener standards with cross-references
 */
export const generatedStandards: ISODINStandard[] = ${JSON.stringify(sortedStandards, null, 2)
  .replace(/"system":/g, 'system:')
  .replace(/"code":/g, 'code:')
  .replace(/"id":/g, 'id:')
  .replace(/"primarySystem":/g, 'primarySystem:')
  .replace(/"description":/g, 'description:')
  .replace(/"designations":/g, 'designations:')
  .replace(/"icsCode":/g, 'icsCode:')
  .replace(/"reference":/g, 'reference:')
  .replace(/"scope":/g, 'scope:')
  .replace(/"image":/g, 'image:')
  .replace(/"(ISO|DIN|ANSI|PN)":/g, '$1:')
} as const;
`;
  
  // Write output file
  fs.writeFileSync(outputFile, tsContent);
  
  console.log(`\n✅ Build complete!`);
  console.log(`   Total standards: ${sortedStandards.length}`);
  console.log(`   ISO standards: ${processedISO.length}`);
  console.log(`   DIN-only standards: ${dinStandards.length}`);
  console.log(`   Standards with images: ${standardsWithImages}`);
  console.log(`   Output: ${outputFile}`);
}

// Run the build
buildStandards().catch(console.error);