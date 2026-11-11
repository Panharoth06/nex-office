# ROADMAP.md — Office Engine

> Engineering milestones for the multi-product office suite: Docs, Sheets, Slides, and Draw on one Rust engine, one PostgreSQL schema, and one real-time sync layer.

---

## Milestone Overview

```
M0  Foundation        ──► M1  Auth & OIDC      ──► M2  Documents & Sharing
    Rust workspace             OIDC, sessions         CRUD, permissions, links
    PostgreSQL + Redis         sync-token minting     templates, comments
    health checks              role enforcement       audit log

M2.5 Typing Slice     ──► M3  Real-Time Sync    ──► M4  Product Engines
    Wasm engine in web         Rust WS gateway          Docs, Sheets, Slides
    HiddenInput → engine       Redis pub/sub            Draw surfaces
    caret, click, IME          presence, snapshots      formula + scene graph
```

---

## M0 — Foundation (current)

**Objective:** One Rust workspace, one PostgreSQL schema, and runnable service skeletons.

- [x] Rust workspace: `domain`, `storage`, `auth`, `api`, `sync`, `worker`, `engine`.
- [x] PostgreSQL schema and migrations (documents, permissions, share links, templates, snapshots, comments, suggestions, SSO).
- [x] Postgres-only policy; SQLite removed from the stack.
- [x] API binary with `/healthz`, `/readyz`, structured logs, graceful shutdown.
- [x] Sync binary with JWT-gated WebSocket upgrade and read-only mutation rejection.
- [x] Docker Compose for PostgreSQL 16 and Redis 7.
- [x] CI: `cargo fmt`, `cargo clippy`, `cargo test`, TypeScript typechecks.
- [ ] Drizzle schema mirror generated and verified against the SQL schema.

**Gate:** `docker compose up -d`, `cargo run -p office-engine-api` serves health checks, and `cargo run -p office-engine-sync` rejects unauthenticated WebSocket upgrades.

---

## M1 — Authentication & OIDC

**Objective:** Production-grade identity without trusting the client.

- [x] OIDC authorization code flow with PKCE, `state`, and `nonce`.
- [x] Discovery document loaded at startup and JWKS-backed ID-token verification.
- [x] ID-token validation: signature, `iss`, `aud`, `exp`, `nonce`.
- [x] Account linking by verified email only.
- [x] Redis-backed sessions (`tower-sessions`) with secure cookies.
- [ ] Email/password with Argon2id, magic links, password reset.
- [ ] Per-workspace SSO provider registration and email-domain routing.
- [x] `POST /api/sync/token` mints short-lived, document-scoped JWTs.
- [ ] Audit events for sign-in, SSO changes, and session revocation.

**Gate:** a Keycloak/Okta provider signs in via discovery, a session cookie is issued, and the minted sync token is accepted by the Rust gateway while a forged token is rejected.

---

## M2 — Documents, Permissions & Sharing

**Objective:** Google Docs-style document lifecycle and two-tier access control.

- [x] Document CRUD scoped by `kind` (`doc`, `sheet`, `slides`, `draw`): create, list, read, rename, archive, snapshot load/save.
- [ ] Direct permissions: `owner`, `editor`, `commenter`, `viewer`.
- [ ] Share links: `restricted`, `public_view`, `public_comment`, `public_edit`.
- [ ] Optional link password and expiry; constant-time verification.
- [ ] Template gallery and 1-click clone in under 500ms.
- [ ] Comments, mentions, replies, resolve.
- [ ] Revision history reads and named versions.
- [ ] Activity log for security-relevant actions.

**Gate:** an owner creates a public viewer link; an unauthenticated incognito session opens it read-only and every mutation is rejected.

---

## M2.5 — Typing Vertical Slice

**Objective:** prove the input → engine → canvas path before persistence and sync land.

- [x] Build `crates/engine` to Wasm and load it from `apps/web`.
- [x] Bridge `HiddenInput` → `EngineCore::insert_text` / `delete_range`.
- [x] Canvas line layout measured in Unicode code points.
- [x] Caret rendering, arrows, Home/End, and click-to-place.
- [x] IME composition preview and commit.
- [x] Docker web image builds the Wasm engine; `make wasm` for local dev.
- [x] Playwright smoke test: English, CJK, Vietnamese, backspace, click, composition.
- [ ] Persistence and document loading (arrives with M2/M3).

**Gate:** typing at `/editor/demo` updates the canvas, the caret follows the input, and clicking places the caret. Text is in memory only.

---

## M3 — Real-Time Sync & Presence

**Objective:** Multi-user co-authoring that survives pod restarts.

- [ ] Loro binary relay over the Rust WebSocket gateway.
- [ ] Redis pub/sub room fan-out; no sticky-session requirement.
- [ ] Presence with TTL: carets, selections, names, colors.
- [ ] Per-document advisory lock for snapshot writes.
- [ ] Debounced snapshot flush (500ms–2s) with monotonic versions.
- [ ] Reconnect with version-vector diff, not full snapshots.
- [ ] Backpressure: message size, rate, room size, buffer limits.
- [ ] Multi-replica load test with simulated clients.

**Gate:** two browser sessions on different sync pods see each other's carets and edits with no lost updates; killing one pod drops zero persisted changes.

---

## M4 — Product Engines

**Objective:** Ship the four rendering surfaces on the shared engine.

### Docs

- [x] Flow layout, A4 pagination, linked headers/footers.
- [x] Undo/redo with grouped typing history and zone-wide operations.
- [ ] Sections, first-page/odd-even headers, page-number fields.
- [ ] Rich text, styles, lists, tables, images, footnotes.
- [ ] Hidden input proxy with CJK/Vietnamese IME.
- [ ] 3-tier canvas and R-tree hit-testing.

### Sheets

- [ ] Sparse grid and virtualized rendering for 10M+ cells.
- [ ] Formula parser, dependency graph, incremental recalculation.
- [ ] Number formats, conditional formatting, validation, filters.
- [ ] Pivot tables and chart editor.

### Slides

- [ ] Scene graph, masters/layouts, themes.
- [ ] Text, shapes, connectors, images, tables, charts.
- [ ] Animations, transitions, presenter view.
- [ ] Slide sorter and thumbnails.

### Draw

- [ ] Infinite canvas, pen/highlighter, shape recognition.
- [ ] Connectors, sticky notes, layers.
- [ ] PNG/SVG/PDF export.

**Gate:** each product meets its contract in `AGENTS.md` with no regressions in shared auth, sharing, or sync.

---

## M5 — Interoperability, Enterprise & Scale

**Objective:** File fidelity and operational maturity.

- [ ] `.docx`, `.xlsx`, `.pptx` import/export with round-trip fixtures.
- [ ] Vector PDF export in the worker.
- [ ] PDF viewer with search and annotations.
- [ ] PgBouncer tuning, read replicas, snapshot partitioning.
- [ ] OpenTelemetry traces and Prometheus dashboards.
- [ ] Per-workspace SSO enforcement, group-to-role mapping, session revocation.
- [ ] WCAG 2.1 AA audit across all products.
- [ ] Offline editing with IndexedDB/OPFS and conflict-free merge.

**Gate:** round-trip a `.docx`, `.xlsx`, and `.pptx` without structural loss; export a 100-page document and a 50-slide deck without blocking API latency.
