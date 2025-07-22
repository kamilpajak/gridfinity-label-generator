# Gridfinity Label Generator

Create professional labels for Gridfinity storage system - perfect for organizing hardware, tools, and parts.

## Features

- 🛠️ **Extensive Hardware Library**: Pre-loaded images for screws, nuts, and washers (DIN & ISO standards)
- 📏 **Multiple Label Sizes**: Support for various Gridfinity label dimensions
- 🌍 **Measurement Systems**: Both metric and imperial unit support
- 🎨 **Smart Layout**: Automatically optimized text and image positioning
- 📱 **QR Code Integration**: Generate QR codes for part references or inventory tracking
- 💾 **PNG Export**: Download high-quality label images for printing
- 📱 **Mobile Friendly**: Responsive design works on all devices
- 🔒 **Privacy Focused**: All fonts loaded locally - no external dependencies

## Usage

### Try it Online

Visit [https://gridfinitylabels.com](https://gridfinitylabels.com)

### Run with Docker

```bash
# Docker Hub
docker run -p 80:80 kamilpajak/storage-label-maker:latest

# GitHub Container Registry
docker run -p 80:80 ghcr.io/kamilpajak/gridfinity-label-generator:latest
```

### Run Locally

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## Development Commands

```bash
npm run build        # Build for production
npm run test         # Run tests
npm run release:auto # Create new release
```

## Testing

### Current Testing Setup

The project uses **Vitest** for unit testing with the following test coverage:

- Component unit tests
- Utility function tests
- Label generation logic tests

### Future Testing Recommendations

#### E2E Testing Framework: Playwright

For future end-to-end testing implementation, **Playwright** is recommended due to:

1. **Cross-browser support** - Test on Chrome, Firefox, Safari/WebKit, and Edge
2. **TypeScript integration** - First-class TypeScript support matching our codebase
3. **Debugging capabilities** - Built-in trace viewer, video recording, and screenshots
4. **Performance** - Fast parallel execution and reliable test runs
5. **CI/CD integration** - Native GitHub Actions support

#### Example E2E Test Structure

```typescript
// tests/e2e/label-generation.spec.ts
import { test, expect } from '@playwright/test'

test('generate hardware label', async ({ page }) => {
  await page.goto('/')

  // Select hardware type
  await page.getByRole('button', { name: 'Screw' }).click()

  // Configure label settings
  await page.getByRole('button', { name: 'Metric' }).click()
  await page.getByText('M6').click()

  // Verify preview
  await expect(page.getByAltText(/Generated label/)).toBeVisible()

  // Download label
  await page.getByRole('button', { name: 'Download' }).click()
})
```

#### Component Testing Limitations

Due to Qwik framework's architecture, component-level testing has limitations:

- Qwik components use lazy loading and serialization
- Limited testing library support for Qwik-specific features
- Recommended to focus on E2E tests for UI behavior verification

For detailed testing implementation, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Docker Images

- Docker Hub: https://hub.docker.com/r/kamilpajak/storage-label-maker
- GitHub Container Registry: https://ghcr.io/kamilpajak/gridfinity-label-generator

## Copyright

© 2025 Kamil Pająk. All rights reserved.
