# ========================================
# Base Stage
# ========================================
ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION} AS base
# Set working directory
WORKDIR /app
# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 -G nodejs && \
  chown -R nodejs:nodejs /app

# ========================================
# Dependencies Stage
# ========================================
FROM base AS deps
# Copy package files
COPY package*.json ./
# Install production dependencies
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
  npm ci --omit=dev && \
  npm cache clean --force
# Set proper ownership
RUN chown -R nodejs:nodejs /app
# ========================================
# Build Dependencies Stage
# ========================================
FROM base AS build-deps
# Copy package files
COPY package*.json ./
# Install all dependencies with build optimizations
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
  npm ci --no-audit --no-fund && \
  npm cache clean --force
# Create necessary directories and set permissions
RUN mkdir -p /app/datas && \
  chown -R nodejs:nodejs /app
# ========================================
# Build Stage
# ========================================
FROM build-deps AS build
# Copy only necessary files for building (respects .dockerignore)
COPY --chown=nodejs:nodejs . .
# Set proper ownership
RUN chown -R nodejs:nodejs /app

# ========================================
# Production Stage
# ========================================
ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION} AS production
# Set working directory
WORKDIR /app
# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 -G nodejs && \
  chown -R nodejs:nodejs /app
# Set optimized environment variables
ENV NODE_ENV=production \
  NODE_OPTIONS="--max-old-space-size=256 --no-warnings" \
  NPM_CONFIG_LOGLEVEL=silent
# Copy production dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package*.json ./
# Switch to non-root user for security
USER nodejs
# Expose port
EXPOSE 8080 8887
# Volumes
VOLUME [ "/datas", "/logs", "/config" ]
# Start production server
CMD ["node", "index.js"]
