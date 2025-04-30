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

The project has multiple ways to create releases:

#### Standard Release (from master)

```bash
# For automatic version bump based on conventional commits
npm run release:auto

# For specific version bumps
npm run release:patch  # 0.1.13 -> 0.1.14
npm run release:minor  # 0.1.13 -> 0.2.0
npm run release:major  # 0.1.13 -> 1.0.0
```

#### Release Branch Workflow (for major changes)

For significant releases that require testing:

1. Create a release branch:
   ```bash
   npm run release:branch:patch  # Creates branch release/v0.1.14
   npm run release:branch:minor  # Creates branch release/v0.2.0
   npm run release:branch:major  # Creates branch release/v1.0.0
   ```

2. Make final changes, run the version bump, and create a PR to master.

#### Manual Release via GitHub Actions

You can also trigger a release manually through the GitHub Actions UI.

For complete details on the release process, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Docker

### Automated Docker Builds

Docker images are automatically built and published to both DockerHub and GitHub Container Registry when a new version tag is created. The images include proper metadata through OCI-compliant labels.

### Using the Docker Image

```bash
# Pull the latest image from Docker Hub
docker pull kamilpajak/storage-label-maker:latest

# Or pull a specific version
docker pull kamilpajak/storage-label-maker:0.1.13

# Run the container
docker run -p 80:80 kamilpajak/storage-label-maker:latest
```

### Building Locally

The project includes two scripts for Docker operations:

```bash
# Build the image locally without pushing
./docker-build.sh

# Build, test locally, and push to DockerHub
./docker-publish.sh
```

Or manually:

```bash
# Build the image
docker build -t storage-label-maker \
  --build-arg VERSION=$(node -p "require('./package.json').version") \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg COMMIT_SHA=$(git rev-parse --short HEAD) \
  .

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

### Docker Image Metadata

The Docker images include the following OCI-compliant labels:

- `org.opencontainers.image.title`: "Gridfinity Label Generator"
- `org.opencontainers.image.description`: "Label generator for storage systems, with a focus on the Gridfinity system"
- `org.opencontainers.image.version`: The version from package.json
- `org.opencontainers.image.created`: Build timestamp in ISO 8601 format
- `org.opencontainers.image.revision`: Git commit SHA
- `org.opencontainers.image.licenses`: "MIT"
