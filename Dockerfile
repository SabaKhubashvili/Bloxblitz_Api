
# Multi-stage Dockerfile for API service
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
# Build the application (if using TypeScript)
RUN npm run build 2>/dev/null || echo "No build step needed"

# Stage 3: Production
FROM node:20-alpine AS production

# Install wget for health checks
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy application files
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/ ./node_modules/
COPY --from=builder --chown=nodejs:nodejs /app/dist/ ./dist/
COPY --from=builder --chown=nodejs:nodejs /app/prisma/ ./prisma/
COPY --chown=nodejs:nodejs package*.json ./




RUN mkdir -p /app/certs/db_cert && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "dist/src/main.js"]