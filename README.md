# Gridfinity Label Generator

A web application for generating labels for storage systems, with a focus on the Gridfinity system.

## Development

### Express Server

This app has a minimal [Express server](https://expressjs.com/) implementation. After running a full build, you can
preview the build using the command:

```
npm run serve
```

Then visit [http://localhost:8080/](http://localhost:8080/)

### Running Locally

To run the application in development mode:

```
npm install
npm run dev
```

## Versioning and Releases

This project uses [Semantic Versioning](https://semver.org/) and automated release management through GitHub Actions.

### Creating a New Release

The project uses conventional commits and standard-version for automated versioning:

1. Make changes and commit them using conventional commit messages:
   - `feat: add new feature` (triggers a minor version bump)
   - `fix: resolve issue` (triggers a patch version bump)
   - `docs: update documentation` (no version bump)
   - `chore: update dependencies` (no version bump)
   - `refactor: improve code structure` (no version bump)
   - `perf: improve performance` (no version bump)

2. When changes are merged to the main branch, GitHub Actions will automatically:
   - Bump the version based on commit messages
   - Generate a CHANGELOG.md
   - Create a git tag
   - Create a GitHub release

3. Manually trigger a version bump:
   ```
   npm run release         # Automatic version bump based on commits
   npm run release:patch   # Force patch version bump (0.0.x)
   npm run release:minor   # Force minor version bump (0.x.0)
   npm run release:major   # Force major version bump (x.0.0)
   ```

## Docker

### Automated Docker Builds

Docker images are automatically built and published to GitHub Container Registry when a new version tag is created.

### Using the Docker Image

```bash
# Pull the latest image from Docker Hub
docker pull kamilpajak/storage-label-maker:latest

# Or pull a specific version
docker pull kamilpajak/storage-label-maker:1.0.0

# Run the container
docker run -p 80:80 kamilpajak/storage-label-maker:latest
```

### Building Locally

```bash
# Build the image
docker build -t storage-label-maker .

# Run the container
docker run -p 80:80 storage-label-maker
```

### GitHub Container Registry

The image is also available from GitHub Container Registry:

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/kamilpajak/gridfinity-label-generator:latest

# Run the container
docker run -p 80:80 ghcr.io/kamilpajak/gridfinity-label-generator:latest
```
