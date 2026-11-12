# syntax=docker/dockerfile:1

# ---- build: install everything, build the web app ----
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

# ---- prod-deps: runtime dependencies only (no TypeScript, Vite, test tools) ----
FROM node:26-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts

# ---- runtime: Node runs the TypeScript sources directly (type stripping), no compile step ----
FROM node:26-alpine AS runtime
ENV NODE_ENV=production PORT=3000 WEB_DIST=/app/apps/web/dist
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/core/src packages/core/src
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "apps/api/src/server.ts"]
