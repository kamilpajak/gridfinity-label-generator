# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

This project uses **pnpm** as the package manager. All commands should use `pnpm` instead of `npm`.

## Important Notes

### UI Components Documentation

- **ALWAYS use shadcn-svelte documentation** (https://www.shadcn-svelte.com/) for component references
- **DO NOT use shadcn/ui documentation** (https://ui.shadcn.com/) which is for React
- Key differences between shadcn-svelte and shadcn/ui:
  - Props: `value` instead of `defaultValue` for Tabs
  - Imports: Different import paths and structures
  - Syntax: Svelte-specific patterns vs React patterns

### Icons

- **ALWAYS use Lucide icons** from `@lucide/svelte/icons/[icon-name]`
- **DO NOT draw icons manually** as inline SVG
- Import pattern: `import IconName from '@lucide/svelte/icons/icon-name'`
- Use consistent naming: `IconName` (PascalCase) for imported icons

### Testing Guidelines

- Nie uzywaj zahardcodowanych waitForTimeout

## Commands

### Development

- `pnpm dev` - Start development server with hot reload
- `pnpm dev --open` - Start dev server and open in browser
- `pnpm build` - Build production version
- `pnpm preview` - Preview production build

### Testing

- `pnpm test` - Run all tests (unit and e2e)
- `pnpm test:unit` - Run Vitest unit tests in watch mode
- `pnpm test:unit --run` - Run unit tests once
- `pnpm test:e2e` - Run Playwright e2e tests
- Run a single test file: `pnpm test:unit path/to/test.ts`

### Code Quality

- `pnpm check` - Run svelte-check for TypeScript errors
- `pnpm lint` - Check code formatting and ESLint rules
- `pnpm format` - Auto-format code with Prettier

### Standards Data

This project uses two **Single Sources of Truth (SSOT)** for standards data:

#### SSOT 1: Reyher PDF (Cross-references)

**File:** `docs/Reyher_2019-EN_Technische_Informationen_ks.pdf`

The Reyher "Standards Conversion" PDF is the authoritative source for:

- **DIN ↔ ISO mappings** (cross-references between standard systems)
- Which DIN standards correspond to which ISO standards
- Table 1: DIN → ISO conversions
- Table 2: ISO → DIN conversions

When adding or modifying cross-references in `standards-config.json`, always verify against this PDF.

#### SSOT 2: DIN Media (Metadata)

**Website:** [dinmedia.de](https://dinmedia.de)

DIN Media is the authoritative source for:

- **Standard titles** (German and English)
- **Withdrawn status** (current vs withdrawn)
- **Replacement standards** (replacedBy)
- **Publication dates**

#### Pipeline Commands

```bash
# Pipeline: validate → resolve → fetch → build
pnpm standards:validate        # Validate standards-config.json
pnpm standards:resolve         # Resolve standard IDs → DIN Media IDs
pnpm standards:fetch           # Fetch metadata (cached 30 days)
pnpm standards:fetch:force     # Force re-fetch all metadata
pnpm standards:build           # Build standards-generated.ts
pnpm standards:build:strict    # Fail on unexpected withdrawn standards

# Convenience scripts
pnpm standards:refresh         # fetch + build (update cache and rebuild)
pnpm standards:add             # Full pipeline for adding new standards
```

#### Data Files

| File                                | SSOT       | Purpose                           |
| ----------------------------------- | ---------- | --------------------------------- |
| `data/standards-config.json`        | Reyher PDF | Cross-references (din/iso arrays) |
| `data/dinmedia-id-mappings.json`    | DIN Media  | Standard ID → DIN Media ID        |
| `data/dinmedia-metadata-cache.json` | DIN Media  | Titles, status, dates             |
| `docs/Reyher_2019-EN_*.pdf`         | -          | Reference document                |

#### Config Structure

```json
{
	"iso": { "4762": { "din": ["912"] } },
	"din": { "912": { "iso": ["4762", "12474"] }, "127": { "withdrawn": true } }
}
```

#### Validation Gaps (Known Limitations)

1. **ISO standards without DIN Media mapping** - Cannot be validated for withdrawn status
   - Build script warns: "X ISO standard(s) without DIN Media mapping"
   - These standards need manual review when adding to config

2. **No automatic ISO.org validation** - Pipeline doesn't check:
   - If ISO standard exists
   - If ISO standard is withdrawn (stage codes)
   - If ISO standard is in fastener category (ICS 21.060.xx)

3. **Manual config entry** - `standards-config.json` accepts any ID without validation

**Mitigation:** Unit tests in `standards-validation.test.ts` catch known invalid standards.

**Future:** See `docs/plan-standards-validation-pipeline.md` for planned improvements.

### SonarCloud API

Pobieranie metryk projektu (wymaga tokena SONAR_TOKEN):

```bash
curl -s -u "${SONAR_TOKEN}:" "https://sonarcloud.io/api/measures/component?component=kamilpajak_gridfinity-label-generator&metricKeys=bugs,vulnerabilities,code_smells,coverage,reliability_issues,maintainability_issues,security_issues"
```

Pobieranie listy issues:

```bash
curl -s -u "${SONAR_TOKEN}:" "https://sonarcloud.io/api/issues/search?componentKeys=kamilpajak_gridfinity-label-generator&ps=100&facets=types,severities"
```

### Survey API

Pobieranie zagregowanych odpowiedzi z ankiety (Google Apps Script):

```bash
curl -sL "https://script.google.com/macros/s/AKfycbwONjLlojIlD9sSZ4R_7qDBMladUNxGOuA-U0YIoROghmfZEgmpy07v0x6EWJbhm0GC6w/exec"
```

Flaga `-L` podąża za redirectami (Google Apps Script zwraca 302).

### Releasing

- `pnpm release:dry-run` - Preview what the next release would be
- `pnpm release` - Create a new release (bumps version, tags, pushes)

## Commit Conventions

This project uses **Conventional Commits** enforced by commitlint.

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type       | Description                 | Version Bump |
| ---------- | --------------------------- | ------------ |
| `feat`     | New feature                 | minor        |
| `fix`      | Bug fix                     | patch        |
| `docs`     | Documentation only          | -            |
| `style`    | Formatting, no code change  | -            |
| `refactor` | Code change, no feature/fix | -            |
| `perf`     | Performance improvement     | patch        |
| `test`     | Adding tests                | -            |
| `build`    | Build system changes        | -            |
| `ci`       | CI configuration            | -            |
| `chore`    | Other changes               | -            |

### Breaking Changes

Add `!` after type or include `BREAKING CHANGE:` in footer for major version bump:

```
feat!: remove deprecated API
```

## Release Process

1. **Write code** with conventional commits
2. **Update CHANGELOG.md** manually (user-friendly descriptions)
3. **Run `pnpm release:dry-run`** to preview version bump
4. **Run `pnpm release`** to create release
5. **GitHub Actions** creates GitHub Release automatically

## Architecture

### Stack

- **SvelteKit** - Full-stack framework with file-based routing
- **Svelte 5** - Using runes syntax (`$props()`, `@render`)
- **TypeScript** - Full type safety
- **Tailwind CSS v4** - Utility-first CSS via Vite plugin
- **Zustand** - State management (installed but not yet implemented)
- **Vitest** - Unit testing with browser and node environments
- **Playwright** - E2E testing

### Project Structure

- `/src/routes/` - File-based routing, each `+page.svelte` is a route
- `/src/lib/` - Shared utilities and components
- `/src/app.css` - Global styles with Tailwind directives
- `/src/app.d.ts` - TypeScript ambient declarations

### Testing Setup

- Unit tests use Vitest with separate browser and node environments
- Browser tests: `*.svelte.test.ts` files run in Playwright browser
- Node tests: Regular `*.test.ts` or `*.spec.ts` files
- E2E tests in `/e2e/` directory using Playwright

### Key Patterns

- Components use Svelte 5 runes syntax
- Layout uses `$props()` and `@render children()`
- CSS can be component-scoped `<style>` blocks or Tailwind utilities
- Build uses Vite with SvelteKit and Tailwind CSS plugins
