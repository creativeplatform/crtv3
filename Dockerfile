# syntax=docker/dockerfile:1

# Stage 1: Build
FROM node:22.13.1-slim AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY --link package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Install postgresql client
RUN apt-get update && apt-get install -y postgresql-client
# Install additional dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/* 

# Install pnpm globally
RUN npm install -g pnpm
# Install project dependencies
RUN --mount=type=cache,target=/root/.npm pnpm install

# Change directory to Creative ai
WORKDIR /app/packages/creative-ai
# Install additional dependencies

# Copy application files
COPY --link . .

# Build the application
RUN pnpm run build

# Stage 2: Production
FROM node:22.13.1-slim AS production

# Set working directory
WORKDIR /app

# Copy built application and dependencies from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set environment variables
ENV NODE_ENV=production

# Expose the application port
EXPOSE 3050

RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
# Set the command to run the application
CMD ["npm", "run", "start:prod"]
# Stage 3: Development
FROM node:22.13.1-slim AS development
# Set working directory
WORKDIR /app
# Copy application files
COPY --link package.json package-lock.json ./
COPY --link . .
# Install dependencies
RUN --mount=type=cache,target=/root/.npm npm ci

# Run the application
CMD ["npm", "start"]