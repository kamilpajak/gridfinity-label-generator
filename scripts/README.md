# Scripts Directory

This directory contains a unified script for processing and generating standards data for the Gridfinity Label Generator.

## Data Processing Pipeline

```
┌─────────────────────────┐     ┌─────────────────────────┐
│ ISO Metadata JSONL File │     │  standards-config.json  │
│ (~78k standards)        │     │  (crossref, DIN-only,   │
└───────────┬─────────────┘     │   image mappings)       │
            │                   └───────────┬─────────────┘
            │                               │
            └──────────┬────────────────────┘
                       │
                       ▼
             build-all-standards.js
                       │
                       ▼
            ┌─────────────────────────┐
            │ standards-generated.ts  │
            │ (247 standards total)   │
            │ • 145 ISO standards     │
            │ • 102 DIN-only          │
            └─────────────────────────┘
```

## Script

### build-all-standards.js

Unified script that processes all standards data in a single pipeline.

**Purpose:**
- Processes raw ISO metadata from JSONL format
- Filters ~78,000 ISO standards to find fasteners (TC 2 committee)
- Excludes withdrawn and replaced standards
- Maps images to standards
- Applies cross-references and mappings
- Includes DIN-only standards
- Generates final TypeScript module

**Usage:**
```bash
npm run build-standards
```

**Input:**
- `data/raw/iso_deliverables_metadata.jsonl` - Raw ISO standards data
  - Source: [ISO Open Data](https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl)
- `data/standards-config.json` - All configurations

**Output:**
- `src/lib/data/standards-generated.ts` - TypeScript module with all standards

**Features:**
- Processes everything in memory (no intermediate files)
- Supports multiple designation systems (ISO, DIN, ANSI, PN)
- Maps images to standards
- Supports multiple designation systems (ISO, DIN, ANSI, PN)

## Data Files

### standards-config.json

Unified configuration file containing:

```json
{
  "crossref": {
    "iso4762": {"din": ["912"]},
    // ... ISO to DIN/ANSI/PN mappings
  },
  "dinOnly": {
    "din127": {
      "description": "Spring lock washers, Type A"
    },
    // ... DIN standards without ISO equivalents
  },
  "imageMappings": {
    "iso4762": "/images/standards/din_912.jpg",
    // ... standard to image mappings
  }
}
```

## Adding New Standards

### Add ISO→DIN Cross-reference
1. Edit `data/standards-config.json`
2. Add to `crossref` section:
   ```json
   "iso1234": {"din": ["5678"]}
   ```
3. Run: `npm run build-standards`

### Add DIN-only Standard
1. Edit `data/standards-config.json`
2. Add to `dinOnly` section:
   ```json
   "din999": {
     "description": "Description here"
   }
   ```
3. Run: `npm run build-standards`

### Add Image Mapping
1. Edit `data/standards-config.json`
2. Add to `imageMappings` section:
   ```json
   "iso1234": "/images/standards/din_5678.jpg"
   ```
3. Run: `npm run build-standards`

## Data Sources

- ISO metadata: [ISO Open Data](https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl)
- Cross-references based on:
  - [Fuller Fasteners DIN-ISO crossover chart](https://fullerfasteners.com/tech/din-iso-en-crossover-chart/)
  - [Inoxa standards table](https://inoxa.pl/blog/post/tabela-norm-wedlug-din-pn-iso)
  - Industry standard mappings

## Requirements

- Node.js 14+ (for ES modules)
- Raw ISO data file in `data/raw/` (3.7MB, download from ISO Open Data link above)