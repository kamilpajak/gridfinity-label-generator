#!/bin/bash
set -e

# Default to auto version bump
VERSION_TYPE="auto"
CREATE_BRANCH=false

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -p|--patch) VERSION_TYPE="patch"; shift ;;
    -m|--minor) VERSION_TYPE="minor"; shift ;;
    -M|--major) VERSION_TYPE="major"; shift ;;
    -b|--branch) CREATE_BRANCH=true; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
done

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Ensure we're on master branch if not creating a release branch
if [[ "$CREATE_BRANCH" != true && "$CURRENT_BRANCH" != "master" ]]; then
  echo "Error: You must be on the master branch to create a release."
  echo "Use --branch flag to create a release branch instead."
  exit 1
fi

# Pull latest changes
echo "Pulling latest changes from $CURRENT_BRANCH..."
git pull origin $CURRENT_BRANCH

# Get current version from package.json
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
echo "Current version: $CURRENT_VERSION"

# Create release branch if requested
if [[ "$CREATE_BRANCH" == true ]]; then
  # Calculate next version based on version type
  if [[ "$VERSION_TYPE" == "patch" ]]; then
    NEXT_VERSION=$(node -e "const v='$CURRENT_VERSION'.split('.'); v[2]++; console.log(v.join('.'))")
  elif [[ "$VERSION_TYPE" == "minor" ]]; then
    NEXT_VERSION=$(node -e "const v='$CURRENT_VERSION'.split('.'); v[1]++; v[2]=0; console.log(v.join('.'))")
  elif [[ "$VERSION_TYPE" == "major" ]]; then
    NEXT_VERSION=$(node -e "const v='$CURRENT_VERSION'.split('.'); v[0]++; v[1]=0; v[2]=0; console.log(v.join('.'))")
  else
    echo "Error: When creating a release branch, you must specify version type (--patch, --minor, or --major)"
    exit 1
  fi
  
  RELEASE_BRANCH="release/v$NEXT_VERSION"
  
  echo "Creating release branch: $RELEASE_BRANCH for version $NEXT_VERSION"
  git checkout -b $RELEASE_BRANCH
  
  echo "You are now on branch $RELEASE_BRANCH"
  echo "Make any final changes, then run one of the following:"
  echo "  npm run release:patch"
  echo "  npm run release:minor"
  echo "  npm run release:major"
  echo "When ready, create a PR from this branch to master"
else
  # Run the appropriate release command
  if [[ "$VERSION_TYPE" == "auto" ]]; then
    echo "Running automatic version bump based on conventional commits..."
    npm run release
  else
    echo "Running $VERSION_TYPE version bump..."
    npm run release:$VERSION_TYPE
  fi
  
  # Get new version
  NEW_VERSION=$(node -e "console.log(require('./package.json').version)")
  
  echo "Version bumped from $CURRENT_VERSION to $NEW_VERSION"
  
  # Push changes and tags
  echo "Pushing changes and tags to $CURRENT_BRANCH..."
  git push origin $CURRENT_BRANCH --follow-tags
  
  echo "Release v$NEW_VERSION created and pushed to $CURRENT_BRANCH"
  echo "GitHub Actions will now create the GitHub Release and Docker images"
fi
