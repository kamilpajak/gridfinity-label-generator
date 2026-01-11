# Plan: Rock-Solid Standards Validation Pipeline

## Overview

This document describes a multi-layer validation architecture to prevent invalid standards from entering the system.

## Problem Statement

The current DIN Media SSOT approach cannot detect:

- Non-existent ISO standards (e.g., ISO 1581)
- Withdrawn ISO standards without DIN Media mapping
- Standards from wrong categories (e.g., ISO 3266 = lifting equipment, not fasteners)

**Root cause:** `isWithdrawn()` in `build-all-standards.js` returns `false` if a standard has no DIN Media mapping, allowing invalid standards to pass through.

## Architecture

```
                    CURRENT STATE                          TARGET STATE
                    -------------                          ------------
  standards-config.json (manual)          standards-config.json (validated)
           |                                        |
           | (no validation)                        v
           |                              +---------------------+
           |                              | Layer 1: Input      |
           |                              | validate-config.js  |
           |                              +----------+----------+
           |                                         |
           v                                         v
  dinmedia-id-mappings.json               +---------------------+
           |                              | Layer 2: External   |
           v                              | +- validate-iso.js  |<-- iso.org
  dinmedia-metadata-cache.json            | +- scrape-dinmedia  |<-- dinmedia.de
           |                              +----------+----------+
           | (partial validation)                    |
           v                                         v
  build-all-standards.js                  +---------------------+
           |                              | Layer 3: Build      |
           v                              | build --strict      |
  standards-generated.ts                  +----------+----------+
  (may contain invalid)                              |
                                                     v
                                          standards-generated.ts
                                          (only valid standards)
```

## Validation Layers

### Layer 1: Input Validation (Pre-build)

**Script:** `scripts/validate-standards-config.js`

**When:** Before any build, as pre-commit hook or CI check

**Checks:**

- JSON schema validity
- No duplicate entries
- Valid ID format (`iso####` or `din####`)
- Cross-reference consistency (if ISO references DIN, DIN must exist)

### Layer 2: External Validation (Periodic)

#### ISO Validation

**Script:** `scripts/validate-iso-standards.js` (NEW)

**When:** Weekly CI job or manual trigger

**Data source:** ISO Online Browsing Platform (OBP) - iso.org/obp

**Checks:**

- ISO standard exists
- ISO standard is not withdrawn (stage code)
- ISO standard is in fastener category (ICS 21.060.xx)

**Output:** `data/iso-validation-cache.json`

#### DIN Media Validation

**Script:** `scripts/scrape-dinmedia-metadata.js` (EXISTING)

**Enhancement:** Already provides withdrawn status detection

### Layer 3: Build-time Validation

**Script:** `scripts/build-all-standards.js` (EXISTING, enhanced)

**Checks:**

- Reads validation caches (ISO + DIN Media)
- Fails build if any standard is:
  - `WITHDRAWN` (from DIN Media or ISO cache)
  - `NOT_FOUND` (doesn't exist)
  - `WRONG_CATEGORY` (not fastener-related)
- Generates validation report

## Technical Details

### ISO.org Data Access

**Approach:** Playwright-based scraping (similar to DIN Media)

- URL pattern: `https://www.iso.org/standard/{id}.html`
- Rate limit: 1-2 requests/second
- Caching: 30-day validity for current standards, 7-day for withdrawn

### ISO Validation Cache Structure

```json
{
	"_meta": { "version": "1.0", "lastUpdate": "2026-01-11T..." },
	"iso4762": {
		"exists": true,
		"status": "PUBLISHED",
		"stageCode": "90.93",
		"title": "Hexagon socket head cap screws",
		"icsCode": "21.060.10",
		"isFastener": true,
		"fetchedAt": "2026-01-11T...",
		"url": "https://www.iso.org/standard/..."
	},
	"iso1581": {
		"exists": false,
		"status": "NOT_FOUND",
		"fetchedAt": "2026-01-11T..."
	}
}
```

### ICS Category Validation

**Fastener-related ICS codes (valid):**

| Code      | Description               |
| --------- | ------------------------- |
| 21.060.10 | Bolts, screws, studs      |
| 21.060.20 | Nuts                      |
| 21.060.30 | Washers, locking elements |
| 21.060.40 | Rivets                    |
| 21.060.50 | Pins, nails               |
| 21.060.70 | Threaded inserts          |

**Non-fastener codes (reject):**

| Code      | Description         |
| --------- | ------------------- |
| 53.020.30 | Lifting equipment   |
| 23.040.xx | Pipeline components |

### CI Integration

```yaml
# .github/workflows/validate-standards.yml
name: Validate Standards
on:
  schedule:
    - cron: '0 3 * * 0' # Weekly Sunday 3am
  workflow_dispatch: # Manual trigger

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm validate-iso
      - run: pnpm scrape-dinmedia
      - run: pnpm build-standards --strict
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: validation-report
          path: data/*-validation-*.json
```

## Implementation Phases

### Phase 1: Quick Wins [COMPLETED]

**Priority:** Immediate
**Status:** Done (2026-01-11)

1. ~~Fix Issue #37 - Remove 5 invalid standards from config~~ (removed iso4034, iso4036; others already gone)
2. ~~Add build warnings - Log warning for ISO standards without DIN Media mapping~~
3. ~~Document validation gaps - Update CLAUDE.md~~
4. Added TDD tests in `src/lib/data/standards-validation.test.ts`

### Phase 2: Input Validation [COMPLETED]

**Priority:** High
**Status:** Done (2026-01-11)

1. ~~Create `scripts/validate-standards-config.js`~~ - validates structure, ID format, duplicates, cross-refs
2. ~~Add TDD tests~~ - `src/lib/utils/config-validator.test.ts` (25 tests)
3. ~~Add pnpm script~~ - `pnpm validate-config`
4. Add to CI - Run on every PR to standards-config.json (TODO)
5. Add pre-commit hook (optional) (TODO)

### Phase 3: ISO Validation

**Priority:** Medium-High

1. Create `scripts/lib/iso-utils.js` - Playwright-based ISO.org scraper
2. Create `scripts/validate-iso-standards.js` - Main validation script
3. Enhance `scripts/build-all-standards.js` - Add `--strict` mode
4. Create weekly CI workflow

### Phase 4: Full Integration

**Priority:** Medium

1. Unified validation report (HTML + JSON)
2. GitHub issue auto-creation on validation failure
3. ADR documentation for validation architecture

## New pnpm Scripts

```json
{
	"validate-config": "node scripts/validate-standards-config.js",
	"validate-iso": "node scripts/validate-iso-standards.js",
	"validate-all": "pnpm validate-config && pnpm validate-iso && pnpm scrape-dinmedia",
	"build-standards": "node scripts/build-all-standards.js",
	"build-standards:strict": "node scripts/build-all-standards.js --strict"
}
```

## Success Criteria

- [x] Config structure validation (Phase 2)
- [x] ID format validation (Phase 2)
- [x] Duplicate detection (Phase 2)
- [x] Cross-reference validation (Phase 2)
- [x] Build warnings for unmapped ISO standards (Phase 1)
- [ ] No invalid standards can enter standards-generated.ts (Phase 3)
- [ ] Weekly automated validation catches withdrawn standards (Phase 3)
- [ ] ICS category validation rejects non-fastener standards (Phase 3)
- [ ] Clear error messages identify exactly what's wrong
- [ ] CI fails fast on validation errors
- [ ] Minimal manual intervention required

## References

- [Issue #37: Remove 5 invalid standards from config](https://github.com/kamilpajak/gridfinity-label-generator/issues/37)
- [ADR-001: SonarCloud Duplication Exclusions](./adr/001-sonarcloud-duplication-exclusions.md)
- [ISO Online Browsing Platform](https://www.iso.org/obp)
- [DIN Media](https://www.dinmedia.de)
