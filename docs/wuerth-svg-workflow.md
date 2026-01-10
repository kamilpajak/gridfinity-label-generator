# Würth SVG Workflow

## Problem

Current hardware images are scraped from manufacturer websites:

- Legal risk (copyright)
- Inconsistent quality and style
- Missing coverage for many standards

## Solution

Obtain clean SVG technical drawings from Würth CAD database.

## Approach

```
Würth CAD → 2D SVG export → use directly
```

Würth offers direct 2D export in SVG format with full thread detail. No conversion needed.

## Tasks

### 1. Würth 2D Workflow

- [x] Discover Würth CAD 2D export capability
- [x] Test 2D SVG export for DIN 912
- [x] Verify thread detail in 2D SVG - full geometry present

### 2. Combine Views

- [x] Create script to combine back + left views into single SVG
- [x] Match image layout: `[side view] [head view]`
- [x] Maintain proportions (scale left view to match back height)

### 3. Validation

- [x] Würth 2D SVG has full thread detail
- [x] Clean technical drawing style
- [x] Combined SVG matches image format
- [x] Test SVG in label preview component

### 4. SVG Priority Implementation

- [x] Add `resolveImageWithSvgPriority()` in `label-renderer.ts`
- [x] Update `label-preview.svelte` to use SVG for aspect ratio calculation
- [x] Update `label-exporter.ts` for export with correct aspect ratio
- [x] Create `StandardImage` component with SVG fallback to PNG
- [x] Update `standard-search.svelte` to use `StandardImage`

### 5. Batch Processing

- [x] Create filename parser (`wuerth-filename-parser.ts`)
- [x] Group files into pairs (back + left)
- [ ] Create mapping: standard ID → Würth CAD product
- [ ] Manual SVG download via Würth Download Center
- [ ] Batch combine views with script
- [ ] Output to `static/images/standards/`

## Würth CAD

- **Coverage**: 57,000+ parts (fasteners, screws, bolts, nuts, washers, etc.)
- **2D Export**: SVG, PNG, JPG, PDF, DXF, DWG
- **LOD**: Selectable (use highest for full thread detail)
- **Access**: Free, no account required
- **URL**: [eshop.wuerth.de/Browse-cad](https://eshop.wuerth.de/Browse-cad/en/cad/index.jsp)

### Licensing Considerations

| Use Case                          | Status                         |
| --------------------------------- | ------------------------------ |
| Internal design/documentation     | ✅ Allowed                     |
| Generated SVG in application      | ✅ Likely OK (derivative work) |
| Redistribution of raw SVG         | ⚠️ No explicit license         |
| Publishing in open-source library | ⚠️ Not clearly permitted       |

**Recommendation**: The geometry of standardized parts (DIN/ISO) is public domain, but Würth's specific renderings may be copyrighted. Using SVGs in application UI is likely acceptable as documentation/design use.

## Success Criteria

- [x] Direct 2D SVG export from Würth works
- [x] Thread detail visible (high LOD)
- [x] Clean technical drawing style
- [x] No external dependencies (just download)
- [x] SVG renders correctly in label preview
- [x] SVG priority with PNG fallback implemented

## Usage

### 1. Download from Würth

1. Go to [Würth CAD Database](https://eshop.wuerth.de/Browse-cad/en/cad/index.jsp)
2. Navigate: Fasteners → Bolts → Screws, cylinder head → find part
3. Click product → CAD preview → **2D tab**
4. Select: Format = SVG, LOD = High
5. Download **back** view and **left** view separately
6. Download from Download Center

### 2. Combine Views

```bash
node scripts/combine-svg-views.js back.svg left.svg output.svg
```

Example:

```bash
node scripts/combine-svg-views.js \
  Wuerth_back.svg \
  Wuerth_left.svg \
  static/images/standards/din_912.svg
```

## Out of Scope (for PoC)

- Full automation pipeline
- All 200+ standards coverage
- CI integration

## Findings

### Würth 2D SVG

- Direct export in SVG format
- Full thread detail with high LOD setting
- Clean technical drawing style (no dimensions, no annotations)
- Multiple views available (back, left, front, top)
- File size: 4-23 KB per view

### Combine Script

Würth exports views separately, but image images have combined layout. Script `scripts/combine-svg-views.js` merges back + left views:

- Scales left view to match back height
- Places views side by side with gap
- Output matches image format: `[side] [head]`

### SVG Priority

Application automatically prefers SVG over PNG for standard images:

- `resolveImageWithSvgPriority()` tries `.svg` first, falls back to `.png`
- `StandardImage` component handles fallback in search thumbnails
- Aspect ratio calculated from actual loaded image (SVG or PNG)
- No changes needed to `standards-generated.ts` - paths stay as `.png`

Files:

- `src/lib/utils/label-renderer.ts` - SVG priority for canvas rendering
- `src/lib/components/label/label-preview.svelte` - aspect ratio calculation
- `src/lib/utils/label-exporter.ts` - export with correct aspect ratio
- `src/lib/components/shared/standard-image.svelte` - new component
- `src/lib/components/shared/standard-search.svelte` - uses StandardImage
- `src/lib/utils/wuerth-filename-parser.ts` - filename parser
- `src/lib/utils/svg-batch-utils.ts` - batch processing utilities (tested)
- `scripts/combine-svg-views.js` - combines back + left views
- `scripts/batch-combine-svg.ts` - batch orchestrator

### Filename Parser

`src/lib/utils/wuerth-filename-parser.ts` parses Würth filenames:

- Extracts standard info (ISO/DIN codes) from filename
- Matches to internal standard IDs (e.g., `iso4762`, `din931`)
- Groups back + left views into pairs for combining
- Generates target filename (e.g., `iso_4762.svg`)

### Workflow

1. Download back + left SVG from Würth CAD
2. Run `node scripts/combine-svg-views.js back.svg left.svg output.svg`
3. Save combined SVG to `static/images/standards/`
4. App automatically uses SVG if available, falls back to PNG
