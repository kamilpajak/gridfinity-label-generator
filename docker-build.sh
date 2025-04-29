#!/bin/bash
set -e

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
COMMIT_SHA=$(git rev-parse --short HEAD)

echo "Building Docker image for version $VERSION..."
docker build \
  --build-arg VERSION=$VERSION \
  --build-arg BUILD_DATE=$BUILD_DATE \
  --build-arg COMMIT_SHA=$COMMIT_SHA \
  -t kamilpajak/storage-label-maker:$VERSION \
  -t kamilpajak/storage-label-maker:latest \
  .

echo "Docker image successfully built!"
echo "  - kamilpajak/storage-label-maker:$VERSION"
echo "  - kamilpajak/storage-label-maker:latest"
echo ""
echo "To run the container locally:"
echo "  docker run -p 8080:80 kamilpajak/storage-label-maker:$VERSION"
echo ""
echo "To push to DockerHub:"
echo "  docker login"
echo "  docker push kamilpajak/storage-label-maker:$VERSION"
echo "  docker push kamilpajak/storage-label-maker:latest"
