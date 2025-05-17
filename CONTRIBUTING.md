# Contributing to Gridfinity Label Generator

Thank you for considering contributing to the Gridfinity Label Generator! This document outlines the development workflow for this single-developer personal project.

## Development Setup

### Prerequisites

- Node.js (^18.17.0 || ^20.3.0 || >=21.0.0)
- npm (comes with Node.js)

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/kamilpajak/gridfinity-label-generator.git
   cd gridfinity-label-generator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Visit [http://localhost:5173/](http://localhost:5173/) to see the application.

## Development Workflow

This project uses a streamlined workflow optimized for single-developer work:

### 1. Feature Development

```bash
# Create a feature branch
git checkout -b feature/new-feature

# Make your changes
# Code is automatically linted and formatted on commit

# Commit with conventional commits
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/new-feature
```

### 2. Continuous Integration

All branches automatically run:

- Linting (`npm run lint`)
- Formatting checks (`npm run fmt.check`)
- Type checking (`npm run build.types`)
- Tests (`npm test`)
- Build verification (`npm run build`)

### 3. Merging to Master

Once CI passes, merge directly without PR:

```bash
# Switch to master
git checkout master

# Merge your feature
git merge feature/new-feature

# Push to master
git push origin master
```

The release workflow will automatically:

1. Bump version based on conventional commits
2. Update CHANGELOG.md
3. Create a git tag
4. Create a GitHub Release
5. Build and push Docker images

## Code Quality

### Pre-commit Hooks

The project uses Husky and lint-staged to automatically:

- Fix ESLint issues
- Format code with Prettier
- Validate TypeScript types

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add new feature` (triggers minor version bump)
- `fix: resolve issue` (triggers patch version bump)
- `docs: update documentation` (no version bump)
- `chore: update dependencies` (no version bump)
- `refactor: improve code structure` (no version bump)
- `perf: improve performance` (no version bump)

### Testing

- Write tests for new features and bug fixes
- Run `npm test` to run the test suite
- Run `npm run test:coverage` to generate a coverage report

## Release Process

Releases are automated based on conventional commits:

### Automatic Release

Simply push to master with proper commit messages:

```bash
git commit -m "feat: add new feature"
git push origin master
```

The system will automatically:

1. Bump version (minor for feat, patch for fix)
2. Update CHANGELOG.md
3. Create a git tag
4. Create GitHub Release
5. Build and push Docker images

### Manual Release

For specific version bumps:

```bash
# Patch release (0.1.13 -> 0.1.14)
npm run release:patch

# Minor release (0.1.13 -> 0.2.0)
npm run release:minor

# Major release (0.1.13 -> 1.0.0)
npm run release:major
```

## Docker Images

Images are automatically published to:

- DockerHub: `kamilpajak/storage-label-maker`
- GitHub Container Registry: `ghcr.io/kamilpajak/gridfinity-label-generator`

### Local Docker Build

```bash
./scripts/docker-build.sh
```

## Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm test                 # Run tests
npm run lint             # Check linting
npm run fmt              # Format code

# Release
npm run release:auto     # Auto version bump
npm run release:patch    # Patch release
npm run release:minor    # Minor release
npm run release:major    # Major release

# Docker
./scripts/docker-build.sh  # Build locally
```

## Questions and Support

If you have questions, please open an issue on the GitHub repository.
