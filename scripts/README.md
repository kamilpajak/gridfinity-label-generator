# Scripts Directory

This directory contains scripts for processing and generating standards data with images for the Gridfinity Label Generator.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              STANDARDS DATA (maintainer-only pipeline)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   dinmedia.de (descriptions)                                    │
│        │                                                        │
│        ▼                                                        │
│   generate-dinmedia-mappings.js → scrape-dinmedia-metadata.js   │
│        │                                                        │
│        ▼                                                        │
│   data/dinmedia-*.json  (local, git-ignored)                    │
│        │                                                        │
│        ▼                                                        │
│   build-all-standards.js ◄── standards-config.json              │
│        │                     + image-mappings.json              │
│        ▼                                                        │
│   src/lib/data/standards-generated.ts  (committed, shipped)     │
│        │                                                        │
│        ▼                                                        │
│   validate-images.js                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> The committed `standards-generated.ts` is authoritative; the app builds from it
> directly. PNG images live in `static/images/standards/` and are mapped via
> `data/image-mappings.json`.

## Scripts

### DIN Media Integration

#### generate-dinmedia-mappings.js

Searches dinmedia.de for each standard and creates ID mappings.

```bash
pnpm generate-dinmedia-mappings              # Incremental (skip existing)
pnpm generate-dinmedia-mappings --force      # Re-search all
pnpm generate-dinmedia-mappings --limit=10   # Test with limit
pnpm generate-dinmedia-mappings --delay=2000 # Custom delay (ms)
```

**Output:**

- `data/dinmedia-id-mappings.json` — Standard ID → DIN Media ID mappings

---

#### scrape-dinmedia-metadata.js

Scrapes metadata (title, status, date) from dinmedia.de for each mapped standard.

```bash
pnpm scrape-dinmedia              # Incremental (skip cached < 30 days)
pnpm scrape-dinmedia:force        # Re-fetch all
pnpm scrape-dinmedia --limit=10   # Test with limit
pnpm scrape-dinmedia --delay=2000 # Custom delay (ms)
```

**Output:**

- `data/dinmedia-metadata-cache.json` — Cached metadata (SSOT for descriptions)

**Features:**

- Retry with exponential backoff (3 attempts)
- Cache validity: 30 days (7 days for WITHDRAWN standards)
- Detects WITHDRAWN status

---

### Build

#### build-all-standards.js

Unified script that generates the final TypeScript module.

```bash
pnpm build-standards
```

**Input:**

- `data/standards-config.json` — Standards list (crossref, dinOnly)
- `data/image-mappings.json` — Image mappings (SSOT)
- `data/dinmedia-metadata-cache.json` — Descriptions (SSOT)

**Output:**

- `src/lib/data/standards-generated.ts` — TypeScript module with all standards

---

#### hardware-type-mappings.js

Helper module for categorizing fastener hardware types.

**Not executed directly** — imported by build-all-standards.js.

---

#### lib/playwright-utils.js

Shared utilities for Playwright-based scraping scripts.

**Not executed directly** — imported by generate-dinmedia-mappings.js and scrape-dinmedia-metadata.js.

**Exports:**

- `sleep(ms)` — Async sleep
- `retryWithBackoff(fn, maxRetries, baseDelayMs)` — Retry with exponential backoff
- `acceptCookies(page, baseUrl)` — Accept cookies on DIN Media
- `parseCliArgs(argv)` — Parse --force, --limit=N, --delay=MS with validation
- `DEFAULT_USER_AGENT` — Browser User-Agent string
- `DINMEDIA_BASE_URL` — DIN Media base URL

---

### Validation & Analysis

#### validate-images.js

Validates that all image references have corresponding files.

```bash
pnpm validate-images
```

**Exit codes:** 0 = success, 1 = missing files

---

#### analyze-aspect-ratios.mjs

Analyzes aspect ratios of standard images.

```bash
pnpm analyze-images           # Show statistics
pnpm analyze-images 1.5 2.0   # Search for specific ratios
```

---

### Release

#### release.js

Automates version bumping and release creation.

```bash
pnpm release:dry-run    # Preview changes
pnpm release            # Create release
```

## Data Files

| File                           | Purpose                            | SSOT for     |
| ------------------------------ | ---------------------------------- | ------------ |
| `standards-config.json`        | Standards list (crossref, dinOnly) | —            |
| `image-mappings.json`          | Image paths                        | Images       |
| `dinmedia-id-mappings.json`    | Standard → DIN Media ID            | —            |
| `dinmedia-metadata-cache.json` | Titles, status, dates              | Descriptions |

## Quick Start

### Initial Setup

```bash
# Install Playwright browser
pnpm exec playwright install chromium
```

### Regular Workflow

```bash
# 1. Generate DIN Media mappings (one-time per new standard)
pnpm generate-dinmedia-mappings

# 2. Scrape metadata (refresh monthly)
pnpm scrape-dinmedia

# 3. Build standards
pnpm build-standards

# 4. Validate
pnpm validate-images
```

### Adding New Standards

#### Add ISO→DIN Cross-reference

1. Edit `data/standards-config.json`:
   ```json
   "crossref": {
     "iso1234": { "din": ["5678"] }
   }
   ```
2. Run: `pnpm generate-dinmedia-mappings && pnpm scrape-dinmedia && pnpm build-standards`

#### Add DIN-only Standard

1. Edit `data/standards-config.json`:
   ```json
   "dinOnly": {
     "din999": { "description": "Fallback description" }
   }
   ```
2. Run: `pnpm build-standards`

## Data Sources

- **Images (PNG):** bundled static assets in `static/images/standards/`
- **Descriptions:** [dinmedia.de](https://www.dinmedia.de) (Single Source of Truth)
- **Cross-references:**
  - [Fuller Fasteners DIN-ISO crossover chart](https://fullerfasteners.com/tech/din-iso-en-crossover-chart/)
  - [Inoxa standards table](https://inoxa.pl/blog/post/tabela-norm-wedlug-din-pn-iso)

## Requirements

- Node.js 18+ (ES modules)
- Playwright (image/metadata scraping)
- Sharp (image processing)
