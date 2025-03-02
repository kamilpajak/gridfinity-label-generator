ARG NODE_VERSION=18.18.2

################################################################################
# Use node image as the base image for all stages.
FROM node:${NODE_VERSION}-alpine AS base

# Set working directory for all build stages.
WORKDIR /usr/src/app

################################################################################
# Create a stage for installing production dependencies.
FROM base AS deps

# Install dependencies using npm ci.
# Mount package.json and package-lock.json to leverage caching.
# Mount a cache to /root/.npm to speed up subsequent builds.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

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
