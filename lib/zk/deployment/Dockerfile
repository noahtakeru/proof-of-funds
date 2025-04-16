# Multi-stage build for Zero-Knowledge Proof System
# Stage 1: Build dependencies and application
FROM node:16-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++ git curl

# Copy package files and install dependencies
COPY lib/zk/package*.json ./
RUN npm ci

# Copy source code
COPY lib/zk/ ./

# Build the application
RUN npm run build:all

# Run tests (can be skipped in CI with --build-arg SKIP_TESTS=true)
ARG SKIP_TESTS=false
RUN if [ "$SKIP_TESTS" = "false" ]; then npm run test:ci; fi

# Stage 2: Create production image
FROM node:16-alpine AS production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copy configuration files
COPY --from=builder /app/config ./config

# Add metadata
LABEL maintainer="ZK System Team <zk-team@example.com>"
LABEL version="1.0.0"
LABEL description="Zero-Knowledge Proof System Container"

# Create a non-root user to run the application
RUN addgroup -g 1001 -S zkgroup && \
    adduser -u 1001 -S zkuser -G zkgroup
USER zkuser

# Expose the application port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Set the default command
CMD ["node", "dist/server.js"]

# Stage 3: Development image
FROM node:16-alpine AS development
WORKDIR /app

# Copy all files
COPY lib/zk/ ./

# Install all dependencies including devDependencies
RUN npm install

# Set environment variables
ENV NODE_ENV=development
ENV PORT=3000

# Expose ports for app and debugging
EXPOSE ${PORT} 9229

# Start in development mode with hot-reloading
CMD ["npm", "run", "dev"] 