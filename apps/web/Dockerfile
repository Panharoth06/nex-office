# syntax=docker/dockerfile:1.7

FROM rust:1.99-trixie AS wasm

ENV CARGO_NET_RETRY=10
ENV CARGO_HTTP_TIMEOUT=60

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN rustup target add wasm32-unknown-unknown \
    && curl -sSf https://rustwasm.github.io/wasm-pack/installer/init.sh | sh

ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    wasm-pack build crates/engine --target web --out-dir /wasm

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/sync/package.json ./apps/sync/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts --filter @office-engine/web...

FROM deps AS builder

WORKDIR /app

COPY apps/web ./apps/web
COPY --from=wasm /wasm ./apps/web/public/wasm

RUN pnpm --filter @office-engine/web exec nuxt prepare \
    && pnpm --filter @office-engine/web build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

COPY --from=builder /app/apps/web/.output ./.output

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
