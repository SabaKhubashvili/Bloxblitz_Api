# ---------------------------
# Stage 1: Dependencies
# ---------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only package.json & package-lock.json for caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy certificates early
COPY ./certs ./certs

# ---------------------------
# Stage 2: Builder
# ---------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy app source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript code
RUN npm run build

# ---------------------------
# Stage 3: Production
# ---------------------------
FROM node:20-alpine AS production
WORKDIR /app

# Install wget for healthchecks
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Copy only what production needs from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/certs ./certs

# Expose port
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start app
CMD ["node", "dist/src/main.js"]