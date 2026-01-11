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
           v                              | DIN Media SSOT      |<-- dinmedia.de
  dinmedia-metadata-cache.json            | (DIN + EN ISO)      |
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

**Script:** `scripts/generate-dinmedia-mappings.js` + `scripts/scrape-dinmedia-metadata.js`

**When:** Weekly CI job or manual trigger

**Data source:** DIN Media (dinmedia.de) - Single Source of Truth for both DIN and ISO

**Key insight:** ISO standards are available on DIN Media as "DIN EN ISO xxxx" (European harmonized versions).

**Checks:**

- Standard exists in DIN Media
- Standard is not withdrawn
- Provides authoritative titles and metadata

**Output:** `data/dinmedia-id-mappings.json`, `data/dinmedia-metadata-cache.json`

### Layer 3: Build-time Validation

**Script:** `scripts/build-all-standards.js` (with `--strict` mode)

**Checks:**

- Reads DIN Media metadata cache
- Fails build if any standard is `WITHDRAWN`
- Warns about unmapped standards (cannot validate)
- Generates validation report

## Technical Details

### DIN Media as Single Source of Truth

**Why not ISO.org?**

1. **Legal concerns:** ISO.org robots.txt explicitly blocks AI bots and has strict copyright terms
2. **DIN Media has ISO data:** European harmonized standards (DIN EN ISO) are available
3. **Simpler architecture:** One scraper instead of two
4. **Proven approach:** DIN Media scraping already works in production

**Search strategy:**

- DIN standards: Search for `"DIN 912"`
- ISO standards: Search for `"EN ISO 4762"` (European adoption)

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
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm validate-config
      - run: pnpm generate-dinmedia-mappings
      - run: pnpm scrape-dinmedia
      - run: pnpm build-standards:strict
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

### Phase 3: DIN Media Enhanced Validation [COMPLETED - REVISED]

**Priority:** Medium-High
**Status:** Done (2026-01-11)

**Original plan:** ISO.org scraping was planned but abandoned due to legal concerns.

**Revised approach:** DIN Media as single source of truth for both DIN and ISO standards.

1. ~~Enhance `scripts/generate-dinmedia-mappings.js`~~:
   - Source: `standards-config.json` (not just image)
   - Search: `"EN ISO xxxx"` for ISO standards
   - TDD tests: `src/lib/utils/dinmedia-search.test.ts` (22 tests)

2. ~~Enhance `scripts/build-all-standards.js`~~:
   - `--strict` mode fails on withdrawn standards
   - Uses DIN Media data only (no ISO.org)

3. ~~Create weekly CI workflow~~ - `.github/workflows/validate-standards.yml`

**Removed (legal concerns):**

- ~~`scripts/lib/iso-utils.js`~~ - ISO.org scraper
- ~~`scripts/validate-iso-standards.js`~~ - ISO validation script
- ~~`src/lib/utils/iso-validator.ts`~~ - ISO validation module
- ~~`src/lib/utils/iso-scraper.ts`~~ - ISO scraper utilities

### Phase 4: Semantic Status for Withdrawn Standards [COMPLETED]

**Priority:** High
**Status:** Done (2026-01-11)

**Problem:** 26 DIN standards are marked as WITHDRAWN by DIN Media, but are still widely manufactured and used.

**Solution:** Add semantic `status` and `replacedBy` fields to config schema.

1. ~~Update config schema~~ - Add `status` (CURRENT/WITHDRAWN) and `replacedBy` fields
2. ~~Update config-validator~~ - Validate new fields with TDD (9 new tests)
3. ~~Update standards-config.json~~ - Add status to 26 withdrawn standards
4. ~~Update build script~~ - Handle withdrawn gracefully (acknowledged vs unexpected)

**Config schema:**

```json
{
	"dinOnly": {
		"din127": {
			"description": "Spring lock washers",
			"status": "WITHDRAWN",
			"replacedBy": "iso7090"
		}
	}
}
```

**CI behavior:**

- `status: WITHDRAWN` with `replacedBy` → OK (info)
- `status: WITHDRAWN` without `replacedBy` → warning
- Unknown standard → fail

### Phase 5: Full Integration

**Priority:** Low

1. Unified validation report (HTML + JSON)
2. GitHub issue auto-creation on validation failure
3. ADR documentation for validation architecture

## New pnpm Scripts

```json
{
	"validate-config": "node scripts/validate-standards-config.js",
	"validate-all": "pnpm validate-config && pnpm scrape-dinmedia",
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
- [x] No withdrawn standards can enter standards-generated.ts (Phase 3 - `--strict` mode)
- [x] Weekly automated validation catches withdrawn standards (Phase 3 - CI workflow)
- [x] Clear error messages identify exactly what's wrong
- [x] CI fails fast on validation errors
- [ ] ICS category validation (deferred - requires ISO.org access)
- [ ] Minimal manual intervention required (Phase 4 - GitHub issue auto-creation)

## Limitations

Due to legal concerns with ISO.org scraping, the following validations are NOT automated:

1. **ICS category validation** - Cannot verify if ISO standard is in fastener category
2. **ISO existence validation** - Cannot verify if ISO standard number exists
3. **Unmapped ISO standards** - ~50% of ISO standards have no DIN Media mapping

**Mitigation:** Manual review required when adding new ISO standards without DIN equivalents.

## References

- [Issue #37: Remove 5 invalid standards from config](https://github.com/kamilpajak/gridfinity-label-generator/issues/37)
- [ADR-001: SonarCloud Duplication Exclusions](./adr/001-sonarcloud-duplication-exclusions.md)
- [DIN Media](https://www.dinmedia.de)
