# AGENTS.md — Office Engine

> **Office Engine** is a multi-product office suite and canvas rendering engine. The state, text shaping, layout, and pagination run in **Rust** (WebAssembly on the client, native services on the server); rendering uses **Google Skia via CanvasKit-WASM** (WebGL/WebGPU); collaboration is powered by **Loro CRDT** and a dedicated Rust **WebSocket sync gateway**; the API, auth, and background jobs are **Rust (axum / tokio / sqlx)**; persistence is **PostgreSQL 16+** with **Redis** and **S3/R2**; the application shell is **Nuxt 3 (Vue 3 + TypeScript + Tailwind CSS + Drizzle ORM)**.

**Current state:** M0 complete; M1 authentication and the M2.5 typing slice are implemented. Feature descriptions are contracts and target scope. Do not claim unimplemented functionality as shipped.

---

## Architectural Blueprint

```
                         ┌─────────────────────────────┐
Browser ────────────────▶│ Edge proxy (Caddy / NGINX)  │
                         │ /   /api   /ws              │
                         └──┬────────┬────────┬────────┘
                            │        │        │
              ┌─────────────▼──┐  ┌──▼─────────────┐  ┌──────────────┐
              │ web (Nuxt 3)   │  │ api (Rust)     │  │ sync (Rust)  │
              │ SSR, UI, BFF   │─▶│ auth, CRUD,    │  │ rooms,       │
              │ no DB access   │  │ ACL, templates │  │ presence     │
              └────────────────┘  └──┬─────────────┘  └──┬───────────┘
                                     │                   │
                          ┌──────────▼───────────────────▼──────────┐
                          │ PostgreSQL 16+ + PgBouncer               │
                          │ Redis (cache, pub/sub, presence)         │
                          │ S3/R2 (exports, thumbnails, blobs)       │
                          └──────────┬───────────────────────────────┘
                                     │
                              ┌──────▼──────┐
                              │ worker      │ exports, thumbnails,
                              │ (Rust)      │ email, compaction
                              └─────────────┘

Client (/editor/**):
  Hidden DOM input → Rust Wasm engine → paint descriptors → Skia 3-tier canvas
```

---

## Multi-Product Engine Contract

Office Engine ships four document kinds behind one engine. Every feature must declare its kind and reuse the shared services below. Do not fork the sync server, permission model, or renderer per product.

### 1. Document Kind Envelope

- Every row in `documents` carries `kind`: `doc` | `sheet` | `slides` | `draw`.
- A document's binary snapshot is opaque to the database. Only the matching engine module may parse it.
- Shared metadata: `id`, `kind`, `title`, `owner_id`, `workspace_id`, `thumbnail`, `is_template`, timestamps.
- Product-specific state lives inside the CRDT snapshot, not in ad-hoc tables, unless it must be queried (e.g., sheet count, slide count) — then store it in `jsonb` metadata.

### 2. Per-Kind Rust Modules

```
crates/engine/src/
├── common/      # ids, units, colors, styles, command bus, undo/redo, rtree
├── doc/         # rope text, inline spans, flow layout, pagination, tables
├── sheet/       # sparse grid, formula parser, calc graph, number formats
├── slides/      # scene graph, masters/layouts, animation timeline
├── draw/        # strokes, shape graph, infinite-canvas helpers
└── render/      # paint-command IR shared by all kinds
```

Rules:
- Shared primitives go in `common/`. Never duplicate geometry, color, or ID types per product.
- Each kind owns its CRDT schema: Docs use a Loro rich-text rope; Sheets use a cell map plus formula metadata; Slides/Draw use a Loro tree/map scene graph.
- Each kind exposes one Wasm entry point (`DocEngine`, `SheetEngine`, `SlidesEngine`, `DrawEngine`) implementing the shared `EngineSurface` trait.
- The renderer never branches on document kind. The engine emits a neutral paint-command IR; the TS renderer consumes it.

### 3. Shared Engine Invariants

1. **One hidden DOM input.** All products use `HiddenInput.vue`. Never attach raw `keydown` typing listeners to a canvas.
2. **One 3-tier renderer.** Background, content, and overlay stay decoupled. Sheets may use tiled layers instead of pages, but the three-layer contract applies.
3. **One spatial index.** Pointer-to-model mapping uses an R-Tree or equivalent `O(log N)` structure. No linear scans across cells, glyphs, or scene nodes.
4. **One async pipeline.** Layout, formula recalculation, pagination, and export run in Web Workers or Wasm threads. The main thread paints and handles input only.
5. **One command bus.** Every mutation — typing, formatting, cell edit, slide move — is a serializable command. Undo/redo, sync, and audit consume the same stream.
6. **One permission gate.** The sync server validates a server-signed token before accepting mutations. Viewers and commenters never mutate content.
7. **One snapshot format per kind.** Each kind defines `export_snapshot()` / `import_snapshot()`; the server treats snapshots as opaque bytes.

### 4. Product Contracts

#### Docs — `kind = doc`

Must support: rich-text spans, paragraph styles, lists, tables, images, headers/footers, sections, footnotes, comments, suggestions, page setup, A4 pagination, `.docx` round-trip.

**Finish gate:** click anywhere, type CJK/English via IME, format bold/italic, insert a multi-page table, export a paginated PDF, and see carets move at 60 FPS.

#### Sheets — `kind = sheet`

Must support: sparse grid, formula parser/evaluator, dependency graph, incremental recalc, named ranges, number formats, conditional formatting, data validation, filters, pivots, charts, `.xlsx` round-trip.

**Finish gate:** load a 100k-row workbook, edit a cell feeding a 10k-cell dependency chain, and repaint only dirty cells in under 16ms.

#### Slides — `kind = slides`

Must support: masters/layouts, scene graph, text boxes, shapes, images, tables, charts, animations, transitions, presenter view, `.pptx` round-trip.

**Finish gate:** build a 50-slide deck with images and animations, reorder slides, enter present mode, and export a PDF with correct geometry.

#### Draw — `kind = draw`

Must support: infinite canvas, freehand strokes, shapes, connectors, sticky notes, layers, PNG/SVG/PDF export, live presence.

**Finish gate:** two users draw simultaneously on the same board with no lost strokes and no cursor jitter.

---

## Backend Services & Concurrency

Nuxt Nitro is **not** the application backend. `crates/api` is. `apps/web` is a BFF.

### Ownership

- `apps/web` renders UI and proxies `/api/*`. It must not query the database or enforce permissions.
- `crates/api` owns authentication, authorization, document metadata, permissions, templates, comments, and revision reads.
- `crates/sync` owns WebSocket rooms and CRDT fan-out. It may write live snapshots but must not write document metadata.
- `crates/worker` owns asynchronous exports, thumbnails, email, and compaction.

### Concurrency Rules

1. **Stateless services.** No in-memory sessions, rooms, or locks that assume one instance.
2. **Redis fan-out.** Sync replicas communicate through Redis pub/sub; sticky sessions are an optimization, never a requirement.
3. **One snapshot writer per document.** Use `pg_advisory_xact_lock(hashtext(doc_id))` before writing `document_snapshots`.
4. **PgBouncer required.** Each service has its own bounded pool; never open a connection per request. Disable sqlx statement caching in transaction-pooling mode.
5. **Backpressure is mandatory.** Cap message size, message rate, room size, and buffer growth; drop presence before mutations.
6. **Fail closed.** Missing Redis, JWKS, or session validation must reject traffic, not degrade to anonymous access.
7. **Cache with invalidation.** ACL and share-link caches are invalidated on permission changes via pub/sub.
8. **Contracts live in `crates/domain`.** Cross-service payloads use shared types exported to TypeScript via `ts-rs` or OpenAPI.
9. **Migrations run from CI or the API binary only.** Sync and worker never migrate.
10. **No cross-service table ownership.** One PostgreSQL cluster, but each table has exactly one owning service.

Snapshot writes are debounced 500ms–2s, serialized per document with an advisory lock, and stored as immutable rows with a monotonic `version`. Compaction runs in `crates/worker`.

---

## Authentication, OIDC & Authorization

### Identity

- OIDC authorization code flow with PKCE, `state`, and `nonce`.
- Discovery from `/.well-known/openid-configuration`; JWKS cached with TTL.
- ID token validation: signature, `iss`, `aud`, `exp`, `nonce` before trusting claims.
- Supported providers: Keycloak, Authentik, Okta, Auth0, Microsoft Entra ID, Google Workspace, any compliant OIDC IdP.
- Per-workspace SSO: provider row in `sso_providers`, email-domain routing, DNS domain verification, JIT provisioning, group-to-role mapping.

### Sessions

- `tower-sessions` backed by Redis.
- Cookie: `HttpOnly; Secure; SameSite=Lax`; same-origin through the edge proxy.
- Trusted-origin allowlist; CSRF protection; RP-initiated logout.

### Sync Tokens

- The API mints a short-lived JWT (`sub`, `doc_id`, `role`, `exp`, `jti`) with a maximum 5-minute lifetime.
- `crates/sync` verifies signature, `doc_id`, `role`, and `exp`.
- Client-supplied roles are forbidden. Never read `role` from a query string after authentication.

### Rules for Agents

1. Never expose OIDC secrets to the client. No `NUXT_PUBLIC_*` prefix for `client_secret`, `SYNC_JWT_SECRET`, or provider credentials.
2. Never trust client-supplied roles or user IDs.
3. Require `email_verified` before linking an OIDC identity to an existing account.
4. Domain routing uses a verified allowlist, not substring matching.
5. Unknown IdP groups map to the least privilege.
6. A user authenticated through Workspace A's IdP gains no access to Workspace B without explicit membership.
7. Deleting an SSO provider revokes active sessions and refresh tokens for its linked accounts.
8. If a workspace enforces SSO, never fall back to password login.
9. All document mutations must be tied to an authenticated `userId` or a validated guest share token.
10. Security-relevant actions append to `document_activity_log`.

---

## Database Contract — PostgreSQL

**Policy:** PostgreSQL 16+ is the only supported database. Do not add SQLite, better-sqlite3, libsql, or any embedded fallback. Local development, CI, and production all run PostgreSQL.

### Connection & Tooling

- Server: `sqlx` with `postgres` feature; `crates/storage` owns the pool and repositories.
- Web/BFF: Drizzle schema mirror for type generation and optional migration generation. `apps/web` has no runtime database access.
- Env: `DATABASE_URL=postgresql://user:pass@host:5432/office_engine`.
- Local: `docker compose up -d db redis`.
- SQL migrations: `crates/storage/migrations/**`, applied by `crates/api` at boot or by CI.
- Drizzle migrations: `apps/web/server/database/migrations/**`, for the web-owned schema mirror.

### Column Conventions

- Auth tables (`users`, `sessions`, `accounts`): `text` IDs because OIDC subjects and provider account IDs are strings.
- Domain tables: `uuid` primary keys with `gen_random_uuid()`.
- Timestamps: `timestamptz`, `NOT NULL DEFAULT NOW()`.
- Binary CRDT blobs: `bytea`.
- Flexible metadata: `jsonb`.
- Enums: native PostgreSQL enums for `document_kind`, `document_role`, `share_access`, `suggestion_status`.
- Indexes: every foreign key, plus composite indexes on hot access paths.
- Attachments: S3/R2 object keys only; never store large blobs in PostgreSQL.

### Tables

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `users` | Accounts | `id text pk`, `name`, `email unique`, `email_verified`, `image`, timestamps |
| `sessions` | Sessions | `id text pk`, `token unique`, `user_id`, `expires_at` |
| `accounts` | OAuth / credentials | `id text pk`, `user_id`, `provider_id`, `account_id`, `password` |
| `workspaces` | Team/personal workspaces | `id uuid pk`, `name`, `slug`, `owner_id`, `sso_required`, `allowed_email_domains` |
| `documents` | All document kinds | `id uuid pk`, `kind`, `title`, `owner_id`, `workspace_id`, `is_template`, `thumbnail`, `sheet_meta`, `slides_meta` |
| `document_permissions` | Direct access list | `document_id`, `user_id`, `role`; unique `(document_id, user_id)` |
| `document_share_links` | Link sharing | `document_id`, `access_type`, `secret_token unique`, `password_hash`, `expires_at` |
| `document_templates` | Template gallery | `id uuid pk`, `kind`, `title`, `category`, `snapshot_data bytea`, `is_system` |
| `document_snapshots` | History | `document_id`, `version`, `author_id`, `loro_binary bytea`; unique `(document_id, version)` |
| `document_comments` | Comments & mentions | `id uuid pk`, `document_id`, `author_id`, `anchor jsonb`, `body`, `resolved_at` |
| `document_suggestions` | Track changes | `id uuid pk`, `document_id`, `author_id`, `kind`, `payload jsonb`, `status` |
| `document_activity_log` | Audit trail | `id uuid pk`, `document_id`, `actor_id`, `action`, `metadata jsonb`, `created_at` |
| `sso_providers` | Per-workspace IdPs | `workspace_id`, `provider_id`, `issuer`, `client_id`, `client_secret_encrypted`, `group_role_map` |

### Database Rules

1. Never import from `drizzle-orm/sqlite-core`.
2. Never add a SQLite fallback "for tests" or "for local dev."
3. All migrations are committed SQL files.
4. Integration tests use a dedicated PostgreSQL database/schema, created and torn down per run.
5. The sync server's snapshot flush writes to PostgreSQL, not local files.
6. Encrypt OIDC client secrets at rest (KMS or `pgcrypto` with a KMS-held key).

---

## Language & Service Contract

- `crates/api`, `crates/sync`, `crates/worker`, and `crates/engine` are Rust. No Go or Node in the server data path.
- `apps/web` is TypeScript (Nuxt 3) and contains no business logic or direct database access.
- Shared types live in `crates/domain`; export to TypeScript with `ts-rs` or OpenAPI (`utoipa`).
- OIDC uses the `openidconnect` crate with discovery, PKCE, nonce, and JWKS validation.
- Sessions use `tower-sessions` backed by Redis.
- Pin `loro` to one version across `engine` and `sync`; snapshot compatibility is not guaranteed across minors.
- Do not introduce a new language or service without an explicit architecture decision recorded here.

---

## Project Monorepo Structure

```
office-engine/
├── AGENTS.md
├── README.md
├── ROADMAP.md
├── Cargo.toml
├── Dockerfile.rust            # API / sync / worker image
├── docker-compose.yml         # Full stack
├── Caddyfile                  # Single-origin proxy
├── Makefile                   # up / down / test / psql
├── pnpm-workspace.yaml
├── package.json
│
├── crates/
│   ├── domain/        # Shared IDs, enums, DTOs, command types
│   ├── storage/       # sqlx pool, repositories, migrations
│   ├── auth/          # OIDC, sessions, JWT, password hashing
│   ├── api/           # axum HTTP API
│   ├── sync/          # axum WebSocket gateway
│   ├── worker/        # Exports, thumbnails, email, compaction
│   └── engine/        # Wasm layout engine (lib, document, layout, text)
│
├── apps/
│   ├── web/           # Nuxt 3 application (UI + BFF)
│   │   ├── Dockerfile
│   │   ├── nuxt.config.ts
│   │   ├── pages/
│   │   │   ├── index.vue
│   │   │   └── editor/[id].vue
│   │   ├── server/
│   │   │   └── database/   # Drizzle schema mirror (no runtime DB access)
│   │   └── components/
│   │       ├── shared/
│   │       ├── dashboard/
│   │       └── editor/
│   └── sync/          # Legacy Node sync (deprecated)
│
└── reference/
    ├── canvas-editor/
    └── cosmic-text/
```

---

## Reference Repositories & Lookup Directives

When building features, **never guess or invent canvas geometry algorithms from scratch**. Consult the cloned references in `reference/`:

| Subsystem | Reference Directory | Specific Files to Study |
| :--- | :--- | :--- |
| **IME & Keyboard Input** | `reference/canvas-editor` | `src/editor/core/listener/Keydown.ts`, `Input.ts`, `Composition.ts` |
| **Cursor & Hit-Testing** | `reference/canvas-editor` | `src/editor/core/position/Position.ts`, `Range.ts` |
| **Page Splitting (A4)** | `reference/canvas-editor` | `src/editor/core/draw/frame/` |
| **Rust Text Shaping** | `reference/cosmic-text` | `src/buffer.rs`, `src/font.rs`, `src/shape.rs` |
| **BiDi & Complex Scripts** | `reference/cosmic-text` | `src/bidi.rs` |

---

## Development, Build & Testing

### Code Style & Modularity

- **Concise files:** target ≤ 250 lines, hard ceiling 350. Never write monolithic 1,000+ line files.
- **Strict TypeScript:** strict mode; no `any` unless interfacing with raw Wasm pointers.
- **No default browser widgets:** every visible control comes from `apps/web/components/shared/` (`UiButton`, `UiTextField`, `UiSelect`, `UiMenu`, `UiModal`, `UiTooltip`). Do not ship native `<select>`, `<option>`, `<dialog>`, `<details>`, date/color/file/range/checkbox/radio inputs, native `title` tooltips, or OS scrollbars. The only exception is the invisible `HiddenInput.vue` textarea required for IME. `pnpm lint:ui` enforces this.
- **Idiomatic Rust:** no `unsafe` unless interfacing with low-level Wasm memory. Handle errors explicitly with `Result`.
- **Workspace deps:** declare shared versions in the root `Cargo.toml` `[workspace.dependencies]`.

### Commands (container-first)

- **Run the full stack:** `docker compose up --build` → `http://localhost:8080`
- **Stop and remove volumes:** `docker compose down -v`
- **Rust checks:** `docker compose --profile test run --rm test`
- **Web typecheck:** `docker compose --profile test run --rm web-test`
- **Database shell:** `docker compose exec db psql -U office -d office_engine`
- **Migrations:** applied by the API container at boot
- **Local fallback:** `pnpm dev`, `pnpm dev:api`, `pnpm dev:sync` only when a host toolchain already exists.

### Testing Requirements

- **Container-first:** every service and check must run through Docker Compose; do not make host installs a prerequisite.
- `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --all-features --locked -- -D warnings`, `cargo test --workspace`.
- `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps` to catch broken doc links.
- TypeScript: `tsc --noEmit` for the web app and the legacy sync package.
- SQL: once `sqlx::query!` macros are used, commit `.sqlx/` and run `cargo sqlx prepare --workspace --check` in CI.
- OIDC: integration test against a mock provider (discovery, PKCE, nonce, JWKS).
- Sync: multi-replica load test with simulated WebSocket clients.
- Interop: round-trip fixtures for `.docx`, `.xlsx`, `.pptx`.

---

## Acceptance Criteria & Finish Gates

### Engine

1. **Multi-page A4 canvas:** distinct pages with margins, page numbers, drop shadows.
2. **Smooth IME typing:** clicking focuses the hidden proxy; CJK/English updates the caret without jumping.
3. **Template instantiation:** cloning a template opens a ready-to-edit document in < 500ms.
4. **Link sharing parity:** a public viewer link opens read-only in incognito with mutations disabled.
5. **Real-time multiplayer:** multiple tabs broadcast carets and CRDT changes at 60 FPS.

### Platform

6. **OIDC sign-in:** a Keycloak/Okta provider signs in via discovery, creates a session, and mints a valid sync token.
7. **Role enforcement:** a viewer WebSocket connection has every mutation packet rejected server-side.
8. **Enforced SSO:** password login is refused for a domain whose workspace requires SSO.
9. **Concurrency:** 10k simulated clients across ≥ 2 sync replicas exchange mutations with no lost updates.
10. **Resilience:** killing one sync pod drops zero persisted changes; clients reconnect with a version-vector diff.
11. **Database:** API sustains target RPS through PgBouncer while PostgreSQL stays below 70% connection capacity.
12. **Cache invalidation:** a permission change invalidates cached ACLs within 5 seconds.
