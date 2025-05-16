# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Serve production build
npm run serve
```

### Testing

```bash
# Run all tests
npm test

# Run tests with watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage
```

### Code Quality

```bash
# Run linting
npm run lint

# Format code
npm run fmt

# Check formatting
npm run fmt.check

# Type checking
npm run build.types
```

### Versioning and Releases

```bash
# Automatic version bump based on conventional commits
npm run release:auto

# Specific version bumps
npm run release:patch  # Patch version (0.1.13 -> 0.1.14)
npm run release:minor  # Minor version (0.1.13 -> 0.2.0)
npm run release:major  # Major version (0.1.13 -> 1.0.0)

# Create release branches
npm run release:branch:patch
npm run release:branch:minor
npm run release:branch:major
```

### Docker

```bash
# Build Docker image locally
./docker-build.sh

# Build and publish Docker image
./docker-publish.sh
```

## Project Architecture

This project is a web application for generating labels for storage systems, with a focus on the Gridfinity system. It allows users to create customized labels for hardware items like screws, nuts, and washers.

### Technology Stack

- **Frontend Framework**: Qwik (@builder.io/qwik)
- **CSS Framework**: TailwindCSS
- **Language**: TypeScript
- **Build Tool**: Vite
- **Server**: Express (for SSR and production serving)
- **Testing**: Vitest with Testing Library

### Core Components

1. **Label Generation**

   - Canvas-based rendering (src/lib/labelGenerator.ts)
   - Dynamic text sizing and positioning
   - Image integration and QR code generation
   - PNG export functionality

2. **UI Components**

   - Hardware type selector
   - Thread size selector
   - Standard selector
   - Settings panel for label customization
   - Label preview component

3. **Data Model**
   - Hardware types (Screw, Nut, Washer)
   - Measurement systems (Metric, Imperial)
   - Hardware standards (DIN, ISO)
   - Label settings

### Important Architectural Patterns

1. **State Management**: Uses Qwik's reactive primitives (signals, stores, and tasks)

2. **Component Organization**: Components are in the `src/components` directory, with each component having its own file.

3. **Testing Approach**: Components and utilities have corresponding test files (_.test.ts, _.test.tsx)

4. **Responsive Design**: Different layouts for mobile and desktop using TailwindCSS

5. **Code Style**:
   - Uses Prettier for formatting
   - ESLint for static analysis
   - Pre-commit hooks for code formatting
   - Follows conventional commits for versioning
