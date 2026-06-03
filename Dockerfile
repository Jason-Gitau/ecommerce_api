# 🟢 Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install ALL dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma/schema.prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# 👇 VERIFY: List build output to confirm dist/main.js exists
RUN ls -la /app/dist/ && test -f /app/dist/main.js

# 🟡 Stage 2: Production runtime image
FROM node:20-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

# Prune dev dependencies to keep the image lean
RUN npm prune --production

# Expose port
EXPOSE 3000

# Health check (Ensure your Nest app has an /api/health route!)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# ✅ Startup: Start the app directly (Prisma is already generated)
CMD ["node", "dist/main.js"]