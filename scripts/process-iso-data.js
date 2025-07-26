#!/usr/bin/env node

/**
 * ISO Standards Data Processor
 * 
 * This script processes the raw ISO deliverables metadata JSONL file and extracts
 * fastener standards from ISO Technical Committee 2 (TC 2 - Fasteners).
 * 
 * Purpose:
 * - Extract fastener standards from ~78k ISO standards
 * - Filter out withdrawn and replaced standards
 * - Map ICS codes to hardware types
 * - Generate a clean JSON file for the application
 * 
 * Usage:
 *   npm run process-standards
 *   # or
 *   node scripts/process-iso-data.js
 * 
 * Input:
 *   data/raw/iso_deliverables_metadata.jsonl - Raw ISO metadata (one JSON per line)
 * 
 * Output:
 *   src/lib/data/standards-processed.json - Processed fastener standards
 * 
 * @requires Node.js 14+ (for ES modules)
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ICS (International Classification for Standards) code to hardware type mapping
// ICS 21.060 covers "Fasteners" with subcategories for specific types
// These codes help categorize standards by the type of hardware they describe
const ICS_TO_HARDWARE_TYPE = {
  '21.060.10': ['screw', 'bolt'], // Bolts, screws, studs
  '21.060.20': ['nut'],            // Nuts
  '21.060.30': ['washer'],         // Washers, locking elements
  '21.060.40': ['rivet'],          // Rivets
  '21.060.50': ['pin'],            // Pins, nails
  '21.060.60': ['clamp'],          // Clamps and staples
  '21.060.70': ['spring'],         // Springs
  '21.060.99': ['fastener']        // Other fasteners
};

// Extract ISO number from reference
// Examples:
// - "ISO 4762:2004" -> "4762"
// - "ISO 898-1:2013" -> "898" (ignores part number)
// - "ISO/TR 16224:2012" -> "16224" (handles technical reports)
function extractIsoNumber(reference) {
  const match = reference.match(/ISO\s+(\d+)/);
  return match ? match[1] : null;
}

// Derive hardware types from ICS codes
// A standard can have multiple ICS codes, so we collect all applicable types
// If no specific type is found, defaults to generic 'fastener'
function deriveHardwareTypes(icsCodes) {
  if (!icsCodes || !Array.isArray(icsCodes)) return ['fastener'];
  
  const types = new Set();
  icsCodes.forEach(code => {
    const prefix = code.substring(0, 9); // Get first 9 chars (e.g., "21.060.10")
    if (ICS_TO_HARDWARE_TYPE[prefix]) {
      ICS_TO_HARDWARE_TYPE[prefix].forEach(type => types.add(type));
    }
  });
  
  return types.size > 0 ? Array.from(types) : ['fastener'];
}

// Main processing function
// Reads ISO metadata JSONL file and extracts fastener standards from TC 2 committee
// Filters out replaced and withdrawn standards, keeping only current ones
async function processIsoData() {
  const inputFile = path.join(__dirname, '..', 'data', 'raw', 'iso_deliverables_metadata.jsonl');
  const outputFile = path.join(__dirname, '..', 'src', 'lib', 'data', 'standards-processed.json');
  
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }
  
  const fileStream = fs.createReadStream(inputFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  const standards = [];
  const seenIds = new Set();
  let totalLines = 0;
  let tc2Standards = 0;
  let currentStandards = 0;
  
  console.log('Processing ISO data...');
  
  for await (const line of rl) {
    totalLines++;
    
    if (totalLines % 10000 === 0) {
      console.log(`Processed ${totalLines} lines...`);
    }
    
    try {
      const data = JSON.parse(line);
      
      // Filter for TC 2 committee (Fasteners)
      // Must be exact "ISO/TC 2" or "ISO/TC 2/" (with subcommittee)
      // Examples that PASS: "ISO/TC 2", "ISO/TC 2/SC 11", "ISO/TC 2/SC 7"
      // Examples that FAIL: "ISO/TC 213", "ISO/TC 22", "ISO/TC 27/SC 5"
      if (!data.ownerCommittee || 
          !(data.ownerCommittee === 'ISO/TC 2' || data.ownerCommittee.startsWith('ISO/TC 2/'))) {
        continue;
      }
      
      tc2Standards++;
      
      // Skip if replaced by another standard
      // Example: ISO 4762:1997 has replacedBy: [34460], so we skip it
      // We want the newest version (ISO 4762:2004 with id 34460)
      if (data.replacedBy && data.replacedBy.length > 0) {
        continue;
      }
      
      // Skip withdrawn standards
      // ISO Stage Codes:
      // - 60.60 (6060) = International Standard published
      // - 90.20 (9020) = International Standard under periodical review
      // - 90.60 (9060) = International Standard under review
      // - 90.92 (9092) = International Standard to be revised
      // - 90.93 (9093) = International Standard confirmed (still valid!)
      // - 95.99 (9599) = Withdrawal of International Standard
      // Only 95+ codes indicate withdrawn standards
      if (data.currentStage && data.currentStage >= 9500) {
        continue;
      }
      
      // Extract ISO number
      const isoNumber = extractIsoNumber(data.reference);
      if (!isoNumber) {
        continue;
      }
      
      // Create unique ID (e.g., "iso4762" from "ISO 4762:2004")
      const id = `iso${isoNumber}`;
      
      // Skip duplicates (keep the first one)
      // This handles cases where a standard has multiple editions in the data
      if (seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      
      currentStandards++;
      
      // Map to our structure
      const standard = {
        id,
        description: data.title?.en || data.title?.fr || 'No description',
        designations: [
          { system: 'ISO', code: isoNumber }
        ],
        hardwareTypes: deriveHardwareTypes(data.icsCode),
        icsCode: data.icsCode,
        reference: data.reference,
        publicationDate: data.publicationDate,
        edition: data.edition
      };
      
      // Add scope if available
      if (data.scope?.en) {
        standard.scope = data.scope.en;
      }
      
      standards.push(standard);
      
    } catch (err) {
      console.error(`Error parsing line ${totalLines}: ${err.message}`);
    }
  }
  
  // Sort by ISO number
  standards.sort((a, b) => {
    const numA = parseInt(a.designations[0].code);
    const numB = parseInt(b.designations[0].code);
    return numA - numB;
  });
  
  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write output file
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      totalRecords: totalLines,
      tc2Standards,
      currentStandards,
      source: 'ISO Deliverables Metadata'
    },
    standards
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  
  const fileSizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2);
  
  console.log('\nProcessing complete!');
  console.log(`Total lines processed: ${totalLines}`);
  console.log(`TC 2 standards found: ${tc2Standards}`);
  console.log(`Current standards extracted: ${currentStandards}`);
  console.log(`Output file: ${outputFile}`);
  console.log(`Output file size: ${fileSizeMB} MB`);
}

// Run the script
processIsoData().catch(console.error);