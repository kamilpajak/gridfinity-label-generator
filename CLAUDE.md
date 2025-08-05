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