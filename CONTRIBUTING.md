# Contributing to Gridfinity Label Generator

Thank you for considering contributing to the Gridfinity Label Generator! This document outlines the process for contributing to the project, including development setup, coding standards, and the release process.

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

## Coding Standards

### Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. This helps with automatic versioning and changelog generation.

Examples:

- `feat: add new feature` (triggers a minor version bump)
- `fix: resolve issue` (triggers a patch version bump)
- `docs: update documentation` (no version bump)
- `chore: update dependencies` (no version bump)
- `refactor: improve code structure` (no version bump)
- `perf: improve performance` (no version bump)

### Code Style

- The project uses ESLint and Prettier for code formatting
- Run `npm run lint` to check for linting issues
- Run `npm run fmt` to automatically format TypeScript and Qwik files
- Run `npm run fmt.check` to verify formatting without making changes
- The project now uses a modern Prettier configuration with specific rules for Qwik components
- Pre-commit hooks automatically format staged files using Husky and pretty-quick

### Testing

- Write tests for new features and bug fixes
- Run `npm test` to run the test suite
- Run `npm run test:coverage` to generate a coverage report

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes and ensure tests pass
3. Update documentation as needed
4. Submit a pull request to the `master` branch
5. Wait for code review and address any feedback

## Release Process

The project has a robust release process that uses a two-step workflow:

1. **Version Bump Workflow**: Updates version numbers and creates git tags
2. **GitHub Release Workflow**: Creates GitHub Releases from tags and triggers Docker builds

### Standard Release (from master)

For simple releases directly from the master branch:

```bash
# For automatic version bump based on conventional commits
npm run release:auto

# For specific version bumps
npm run release:patch  # 0.1.13 -> 0.1.14
npm run release:minor  # 0.1.13 -> 0.2.0
npm run release:major  # 0.1.13 -> 1.0.0
```

This will:

1. Bump the version in package.json
2. Update CHANGELOG.md
3. Create a git tag
4. Push changes and tag to GitHub
5. Automatically trigger the GitHub Release workflow
6. Build and push Docker images

### Release Branch Workflow (for major changes)

For significant releases that require testing:

1. Create a release branch:

   ```bash
   # Create a branch for the next patch version
   npm run release:branch:patch  # Creates branch release/v0.1.14

   # Create a branch for the next minor version
   npm run release:branch:minor  # Creates branch release/v0.2.0

   # Create a branch for the next major version
   npm run release:branch:major  # Creates branch release/v1.0.0
   ```

2. Make any final changes and commit them to the release branch

3. When ready, run the version bump on the release branch:

   ```bash
   npm run release:patch  # or release:minor, release:major
   ```

4. Create a pull request from the release branch to master

5. After merging, the following will happen automatically:
   - The Version Bump workflow will be skipped (to prevent loops)
   - The GitHub Release workflow will be triggered by the tag
   - A GitHub Release will be created with release notes
   - Docker images will be built and pushed

### Manual Release Workflow

You can also trigger a version bump manually through the GitHub Actions UI:

1. Go to the "Actions" tab in the GitHub repository
2. Select the "Version Bump" workflow
3. Click "Run workflow"
4. Select the version type (patch, minor, major, or auto)
5. Click "Run workflow"

This will trigger the same process as the standard release.

## Docker Images

The project automatically builds and publishes Docker images to:

- DockerHub: `kamilpajak/storage-label-maker`
- GitHub Container Registry: `ghcr.io/kamilpajak/gridfinity-label-generator`

### Using the Docker Image

```bash
# Pull the latest image from Docker Hub
docker pull kamilpajak/storage-label-maker:latest

# Or pull a specific version
docker pull kamilpajak/storage-label-maker:0.1.13

# Run the container
docker run -p 80:80 kamilpajak/storage-label-maker:latest
```

### Building Docker Images Locally

```bash
# Using the convenience script
./scripts/docker-build.sh

# Or manually
docker build -t storage-label-maker \
  --build-arg VERSION=$(node -p "require('./package.json').version") \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg COMMIT_SHA=$(git rev-parse --short HEAD) \
  .
```

## Questions and Support

If you have questions or need support, please open an issue on the GitHub repository.
