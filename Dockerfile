ARG NODE_VERSION=20.18.1

################################################################################
# Use node image as the base image for all stages.
FROM node:${NODE_VERSION}-alpine AS base

# Set working directory for all build stages.
WORKDIR /usr/src/app

################################################################################
# Create a stage for installing production dependencies.
FROM base AS deps

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies using npm install with legacy peer deps.
# Using --legacy-peer-deps due to Vite 6 vs Qwik 1.14.1 peer dependency conflict.
# Qwik 1.14.1 requires Vite ^5, but we're using Vite 6.3.5 which is backwards compatible.
# Using --ignore-scripts for security to prevent arbitrary script execution during install.
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps --ignore-scripts && \
    npm rebuild && \
    npm run prepare --if-present

################################################################################
# Create a stage for building the application.
FROM deps AS build

# Copy the rest of the source files into the image.
COPY . .

# Run the build script defined in package.json.
RUN npm run build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies.
FROM base AS final

# Build arguments for versioning
ARG VERSION=dev
ARG BUILD_DATE=unknown
ARG COMMIT_SHA=unknown

# Add OCI-compliant labels
# Ensure build arguments are properly passed and used
LABEL org.opencontainers.image.title="Gridfinity Label Generator"
LABEL org.opencontainers.image.description="Label generator for storage systems, with a focus on the Gridfinity system"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"
LABEL org.opencontainers.image.licenses="MIT"

# Set production environment variables.
ENV NODE_ENV=production
ENV HTTP_PORT=80
ENV HTTPS_PORT=443
#ENV ORIGIN=localhost

# Run the application as a non-root user.
USER node

# Copy package.json so that npm commands can be used.
COPY package.json .

# Copy production dependencies from the deps stage and
# the built application from the build stage into the image.
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/server ./server

# Expose the ports that the application listens on.
EXPOSE 80
EXPOSE 443

# Create directory for SSL certificates
USER root
RUN mkdir -p /etc/ssl/gridfinitylabels.com && \
    chown -R node:node /etc/ssl/gridfinitylabels.com

# Switch back to non-root user
USER node

# Start the application.
CMD ["npm", "run", "serve"]
