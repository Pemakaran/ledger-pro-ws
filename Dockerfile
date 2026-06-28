# ---- Stage 1: Development ----
FROM node:22-alpine AS development

WORKDIR /app

# Pin pnpm to the version in package.json's packageManager field (npm install is
# more resilient than corepack on flaky networks — same rationale as the backend).
RUN npm install -g pnpm@10.33.2

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3001

CMD ["pnpm", "run", "start:dev"]


# ---- Stage 2: Build ----
FROM node:22-alpine AS build

WORKDIR /app

RUN npm install -g pnpm@10.33.2

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Strip dev dependencies for a smaller production image
RUN pnpm prune --prod


# ---- Stage 3: Production ----
FROM node:22-alpine AS production

# Security: run as a non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=build --chown=appuser:appgroup /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=appuser:appgroup /app/tsconfig-paths-bootstrap.js ./tsconfig-paths-bootstrap.js

ENV NODE_ENV=production

USER appuser

EXPOSE 3001

CMD ["node", "-r", "./tsconfig-paths-bootstrap.js", "dist/main.js"]
