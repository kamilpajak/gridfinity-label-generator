# syntax=docker/dockerfile:1

# Stage 1: Builder
FROM node:20-alpine AS builder

# Install pnpm (pinned version for reproducible builds)
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and configuration
COPY . .

# Run pre-build scripts if needed
RUN pnpm run build-standards

# Build the application
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# Stage 2: Production
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/CHANGELOG.md ./CHANGELOG.md

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port 80 (to match existing infrastructure)
EXPOSE 80

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=80
ENV HOST=0.0.0.0

# Health check (optional but recommended)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:80/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "build/index.js"]
