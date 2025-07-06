# Use Node.js official image as base
FROM --platform=linux/amd64 node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies (use yarn if yarn.lock exists, otherwise npm)
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; else npm ci; fi

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Debug: Check if build files exist
RUN ls -la ./dist/

# Production stage
FROM --platform=linux/amd64 node:18-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install only production dependencies
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile --production && yarn cache clean; else npm ci --only=production && npm cache clean --force; fi

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Debug: Verify files were copied correctly
RUN ls -la ./dist/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV DOCKER_CONTAINER=true
ENV PORT=3000

# Expose port
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"] 