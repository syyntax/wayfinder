# Wayfinder - Dark Fantasy Cyberpunk Kanban
# Multi-stage Docker build

# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# ==========================================
# Stage 2: Build Backend
# ==========================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies (including dev for build)
RUN npm ci

# Copy backend source
COPY backend/ ./

# ==========================================
# Stage 3: Production Image
# ==========================================
FROM node:20-alpine AS production

LABEL maintainer="Wayfinder Team"
LABEL description="Dark Fantasy Cyberpunk Kanban Collaboration Platform"

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Create non-root user for security
RUN addgroup -g 1001 -S wayfinder && \
    adduser -S wayfinder -u 1001 -G wayfinder

# Copy backend from builder
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/src ./src

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built frontend to serve as static files
COPY --from=frontend-builder /app/frontend/dist ./public

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R wayfinder:wayfinder /app/data

# Copy startup script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8008
ENV DATABASE_PATH=/app/data/wayfinder.db
ENV UPLOAD_DIR=/app/data/uploads

# Expose port
EXPOSE 8008

# Switch to non-root user
USER wayfinder

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8008/api/health || exit 1

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
