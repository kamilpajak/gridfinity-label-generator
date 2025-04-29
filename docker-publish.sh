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

echo "Testing image locally..."
docker run -d -p 8080:80 --name test-container kamilpajak/storage-label-maker:$VERSION
echo "Container started. Please check http://localhost:8080"
echo "Press Enter to continue with pushing to DockerHub, or Ctrl+C to abort"
read

# Stop and remove the test container
docker stop test-container
docker rm test-container

echo "Pushing to DockerHub..."
docker push kamilpajak/storage-label-maker:$VERSION
docker push kamilpajak/storage-label-maker:latest

echo "Docker image successfully built and pushed to DockerHub!"
echo "  - kamilpajak/storage-label-maker:$VERSION"
echo "  - kamilpajak/storage-label-maker:latest"
