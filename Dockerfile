# syntax=docker/dockerfile:1.6

# ----- Stage 1: build -----
FROM node:20-alpine AS builder
WORKDIR /app

# better-sqlite3 needs build tools
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ----- Stage 2: runtime -----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL=file:/app/data/fitness.db

# Pre-create the data dir; will be replaced by the bind mount in production
RUN mkdir -p /app/data /app/data/photos

COPY --from=builder /app/build         ./build
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/package.json  ./package.json
COPY --from=builder /app/drizzle       ./drizzle
COPY --from=builder /app/seed          ./seed

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "build"]
