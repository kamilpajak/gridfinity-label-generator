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

**The committed `src/lib/data/standards-generated.ts` is the authoritative,
shipped dataset.** Building the app does not regenerate it — `pnpm build` uses the
committed file directly. Contributors do not need any external data to build or run
the project.

The pipeline below is a **maintainer-only** tool for refreshing standards data. It
depends on local metadata cache files (`data/dinmedia-*.json`) that are **not
committed** (git-ignored). Cross-references (DIN ↔ ISO mappings) are maintained by
hand in `data/standards-config.json` from public references. Standard numbers and
short titles are used only as factual identifiers; the standards themselves belong to
their publishers (DIN, ISO) — see `THIRD-PARTY-NOTICES.md`.

#### Pipeline Commands (maintainer only)

```bash
# Pipeline: validate → resolve → fetch → build (needs local data/dinmedia-*.json)
pnpm standards:validate        # Validate standards-config.json (no external data)
pnpm standards:resolve         # Resolve standard IDs → DIN Media IDs
pnpm standards:fetch           # Fetch metadata into local cache
pnpm standards:build           # Regenerate standards-generated.ts
```

#### Data Files

| File                         | Committed? | Purpose                           |
| ---------------------------- | ---------- | --------------------------------- |
| `data/standards-config.json` | yes        | Cross-references (din/iso arrays) |
| `data/image-mappings.json`   | yes        | Standard → image mappings         |
| `data/dinmedia-*.json`       | no (local) | Maintainer metadata cache         |

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
