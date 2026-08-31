# syntax=docker/dockerfile:1

# Multi-stage so the published image carries no source, no dev dependencies and
# no build toolchain -- only the standalone server Next emits.

FROM node:22-alpine AS base
WORKDIR /app


# --- dependencies -----------------------------------------------------------
# Split from the build so this layer is reused whenever only source changed.
FROM base AS deps
COPY package.json package-lock.json ./
# `npm ci` installs exactly the lockfile, and fails if the two disagree.
RUN npm ci


# --- build ------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next inlines every NEXT_PUBLIC_* reference into the client bundle at BUILD
# time, so the API URL cannot be supplied at `docker run` -- it must be passed
# here with --build-arg. Left empty, the app serves its own mock routes.
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# --- runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bind all interfaces; the default localhost bind is unreachable from outside
# the container.
ENV HOSTNAME=0.0.0.0

# Run as a non-root user: a compromised process should not own the filesystem.
RUN addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

# `output: "standalone"` emits server.js plus only the node_modules actually
# reached at runtime. Static assets are deliberately NOT included in it and
# have to be copied alongside, or every asset 404s.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
