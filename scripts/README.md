# Scripts Directory

This directory contains data processing scripts for the Gridfinity Label Generator.

## Data Processing Pipeline

```
┌─────────────────────────┐
│ ISO Metadata JSONL File │
│ (~78k standards)        │
└───────────┬─────────────┘
            │
            ▼
    process-iso-data.js
            │
            ▼
┌─────────────────────────┐     ┌────────────────────┐
│ standards-processed.json│     │standards-crossref. │
│ (146 TC 2 standards)    │ ←───│json (manual)       │
└───────────┬─────────────┘     └────────┬───────────┘
            │                            │
            └──────────┬─────────────────┘
                       │
                       ▼
               build-standards.js
                       │
                       ▼
            ┌─────────────────────────┐
            │ standards-generated.ts  │
            │ (146 standards)         │
            └─────────────────────────┘
```

## Scripts

### process-iso-data.js

Processes raw ISO metadata to extract fastener standards.

**Purpose:**
- Filters ~78,000 ISO standards to find fasteners (TC 2 committee)
- Excludes withdrawn and replaced standards
- Maps ICS codes to hardware types

**Usage:**
```bash
npm run process-standards
```

**Input:** `data/raw/iso_deliverables_metadata.jsonl`  
- Source: [ISO Open Data](https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl)

**Output:** `src/lib/data/standards-processed.json`

### build-standards.js

Merges ISO standards with cross-reference mappings.

**Purpose:**
- Combines ISO data with DIN equivalents
- Auto-categorizes standards by head/drive type
- Includes all 146 standards for comprehensive coverage
- Generates TypeScript module

**Usage:**
```bash
npm run build-standards
```

**Input:** 
- `src/lib/data/standards-processed.json`
- `data/standards-crossref.json`

**Output:** `src/lib/data/standards-generated.ts`

## Data Files

### standards-crossref.json

Manual mapping of ISO standards to their DIN equivalents based on:
- [Fuller Fasteners DIN-ISO crossover chart](https://fullerfasteners.com/tech/din-iso-en-crossover-chart/)
- Additional industry sources

Example structure:
```json
{
  "iso4762": {
    "din": ["912"]
  }
}
```

### standards-processed.json

Filtered ISO standards with metadata:
```json
{
  "metadata": {
    "generated": "2025-07-26T12:28:03.497Z",
    "tc2Standards": 666,
    "currentStandards": 146
  },
  "standards": []
}
```

## Adding New Standards

1. **Add cross-references** to `data/standards-crossref.json`
2. **Run build script**: `npm run build-standards`
3. **Test** the generated data in the application

## Filtering to Priority Standards

By default, all 146 standards are included. To filter to 40 priority standards:

1. Edit `scripts/build-standards.js`
2. Uncomment the filter on line 169:
   ```javascript
   // Change from:
   // .filter(std => priorityStandards.includes(std.id))
   // To:
   .filter(std => priorityStandards.includes(std.id))
   ```
3. Re-run: `npm run build-standards`

## Requirements

- Node.js 14+ (for ES modules)
- Raw ISO data file in `data/raw/` (download from [ISO Open Data](https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl))