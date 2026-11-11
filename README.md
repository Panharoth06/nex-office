# Office Engine

> A high-performance, multi-product office suite and canvas rendering engine built with **Rust (WebAssembly + native services)**, **Google Skia (`canvaskit-wasm`)**, **Loro CRDT**, **PostgreSQL**, and **Nuxt 3**.

---

**Status:** M0 complete; M1 authentication, the M2.5 typing slice, the Phase 0 document spine, and the first Phase 1 slices (rich-text marks, multi-page A4 pagination, and paragraph styles) are implemented. The feature lists below are the product contract and target scope, not a claim of shipped functionality. See `ROADMAP.md` and `docs/GOOGLE_DOCS_PARITY_PLAN.md` for milestones.

---

## Table of Contents

- [Product Lines](#-product-lines--one-engine-four-surfaces)
  - [Docs](#-docs-word-processor)
  - [Sheets](#-sheets-spreadsheet)
  - [Slides](#-slides-presentations)
  - [Draw](#-draw-whiteboard--diagrams)
  - [Office Interoperability](#-office-interoperability)
- [Shared Platform Features](#-shared-platform-features)
- [Backend Services](#-rust-backend-services)
- [Architecture](#architecture)
- [The 4 Non-Negotiable Engine Pillars](#the-4-non-negotiable-core-engine-pillars)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Workspace Commands](#workspace-commands)
- [Repository Structure](#repository-structure)
- [Security Model](#security-model)
- [License](#license)

---

## 🧩 Product Lines — One Engine, Four Surfaces

Office Engine is not a single document editor. It is a shared **document engine** with four rendering surfaces that reuse one CRDT sync layer, one Skia renderer, one permission model, and one application shell.

| Product | Surface | Layout model | Document kind |
| :--- | :--- | :--- | :--- |
| **Docs** | Paginated A4 canvas | Flow layout + page splitting | `doc` |
| **Sheets** | Virtualized spreadsheet grid | Sparse cell matrix + calc graph | `sheet` |
| **Slides** | Scene-graph presentation canvas | Absolute scene graph | `slides` |
| **Draw** | Infinite collaborative whiteboard | Scene graph + freehand strokes | `draw` |

### 📄 Docs (Word Processor)

- **Rich text:** bold, italic, underline, strikethrough, superscript, subscript, text color, highlight, font family, font size, letter spacing, line spacing.
- **Paragraphs:** alignment, indentation, spacing before/after, tabs, bullets, numbered lists, multilevel lists, checklists, text direction (LTR/RTL).
- **Styles:** Normal, Title, Subtitle, H1–H6, custom named styles, style inheritance, "update style to match selection."
- **Structure:** sections, columns, page breaks, section breaks, headers, footers, page numbers, different first page, odd/even pages.
- **Page setup:** A4/Letter/Legal/custom size, orientation, margins, background color, watermarks, borders.
- **Navigation:** document outline, headings panel, bookmarks, internal links, auto-updating table of contents.
- **References:** footnotes, endnotes, citations, bibliography.
- **Tables:** row/column insert/delete, merged cells, cell padding, borders, header-row repeat, table styles, nested tables.
- **Images & objects:** inline and floating images, text wrapping, crop, resize, alt text, drawings, text boxes, shapes, charts, LaTeX equations, special characters.
- **Editing:** find & replace (regex, whole word, match case), spellcheck, autocorrect, personal dictionary, word count, reading time.
- **Review:** comments, mentions, replies, resolve, reactions, suggestion mode / track changes, accept/reject changes.
- **Output:** print preview, vector PDF export, `.docx` import/export, PNG export.
- **Collaboration:** live multi-caret presence, follow mode, offline editing, version history, named versions, restore.

### 📊 Sheets (Spreadsheet)

- **Grid:** infinite rows/columns, cell and range selection, multi-range selection, fill handle, drag-fill, auto-fill series.
- **Editing:** formula bar, direct cell editing, paste special, cut/copy/paste ranges, undo/redo, keyboard navigation, frozen rows/columns.
- **References:** A1 notation, absolute/relative/mixed references, named ranges, cross-sheet references, 3D references.
- **Formula engine:** 400+ functions across math, text, date/time, logical, lookup, statistical, financial, array, and web functions.
- **Calculation:** dependency graph, incremental recalc, dirty-cell propagation, circular-reference detection, iterative calculation, volatile-function handling.
- **Arrays:** dynamic arrays, spill ranges, `ARRAYFORMULA`, `FILTER`, `SORT`, `UNIQUE`, `SEQUENCE`, `LAMBDA`, `LET`.
- **Formatting:** number, currency, percent, scientific, date/time, duration, custom formats, text wrap, rotation, borders, merged cells, alternating colors.
- **Conditional formatting:** comparison rules, color scales, data bars, icon sets, custom formula rules.
- **Data tools:** data validation, dropdowns, checkboxes, sorting, filters, filter views, slicers, split text, deduplicate, named views.
- **Analysis:** pivot tables, calculated fields, grouping, charts (line, bar, area, pie, scatter, bubble, histogram, candlestick, geo), sparklines, chart editor.
- **Objects:** images, drawings, comments, notes, hyperlinks, rich text inside cells.
- **Protection:** protected ranges, protected sheets, warning-only vs. hard-lock modes.
- **Performance:** virtualized rendering for 10M+ cells, dirty-cell repaint, worker-based recalculation, chunked workbook loading.
- **Interop:** `.xlsx`, `.csv`, `.tsv` import/export, multi-sheet workbooks, formula translation.
- **Collaboration:** cell-level presence, range highlights, comments, offline editing, version history.

### 🖼 Slides (Presentations)

- **Deck model:** 16:9, 4:3, and custom slide sizes, masters, layouts, themes, theme colors, theme fonts.
- **Authoring:** slide sorter, thumbnails, reordering, sections, duplicate, skip slide, slide transitions.
- **Content:** text boxes, rich text, autofit, shapes, lines, connectors, arrows, freeform paths, images, image masks, crop.
- **Media:** video embeds, audio, autoplay settings, alt text.
- **Data:** tables, charts linked to Sheets, embedded Docs and Draw files.
- **Layout tools:** rulers, guides, grid, snapping, alignment, distribute, group/ungroup, z-order, lock, hide.
- **Motion:** entrance/exit/emphasis animations, motion paths, animation ordering, per-object timing, presenter-controlled builds.
- **Presenting:** present mode, speaker notes, presenter view, timer, pointer/laser, fullscreen, audience Q&A.
- **Collaboration:** live presence, comments, follow mode, version history.
- **Interop:** `.pptx` import/export, PDF export, PNG/JPEG export per slide, print handouts.

### ✏️ Draw (Whiteboard & Diagrams)

- **Canvas:** infinite pan/zoom canvas, minimap, frames, layers.
- **Drawing:** pen, highlighter, eraser, shape recognition, freehand smoothing, pressure support.
- **Objects:** shapes, connectors, sticky notes, text boxes, images, tables, embeds.
- **Collaboration:** live cursors, follow mode, comment pins, offline editing.
- **Output:** PNG, SVG, PDF export; embed in Docs and Slides.

### 📥 Office Interoperability

- **Import:** `.docx`, `.xlsx`, `.pptx`, `.csv`, `.tsv`, `.pdf`, `.png`, `.jpg`, `.svg`.
- **Export:** `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.csv`, `.png`, `.svg`.
- **Round-trip fidelity:** styles, lists, tables, images, charts, comments, and page/slide geometry.
- **Print pipeline:** vector output, page ranges, scaling, headers/footers.
- **PDF viewer:** multi-page rendering, text selection, search, annotations, form fields (later phase).

---

## 👥 Shared Platform Features

- **Accounts & workspaces:** email/password, magic link, Google OAuth, generic OIDC, passkeys, MFA, personal and team workspaces.
- **Dashboard:** recent, starred, owned, shared-with-me, templates, trash, search, folder organization.
- **Templates:** system templates per product plus user-saved templates; 1-click clone in under 500ms.
- **Sharing:** direct user roles (`owner`, `editor`, `commenter`, `viewer`) and link sharing (`restricted`, `public_view`, `public_comment`, `public_edit`) with optional password and expiry.
- **Comments:** inline comments, mentions, replies, resolve, reactions, notifications, email digests.
- **History:** incremental CRDT checkpoints, named versions, visual diff, one-click restore.
- **Presence:** colored carets, name tags, selections, follow mode, active-user avatars.
- **Offline:** IndexedDB/OPFS persistence, queued mutations, conflict-free merge on reconnect.
- **Governance:** audit log, activity feed, admin console, storage quotas, retention policy.
- **Accessibility:** WCAG 2.1 AA, screen-reader DOM mirror, keyboard-only operation, reduced-motion mode.
- **Internationalization:** UI locales, RTL layout, CJK/Vietnamese IME, locale-aware number and date formats.
- **Responsive:** desktop, tablet, touch gestures, mobile read-and-light-edit mode.

### 🔐 OIDC & Enterprise SSO

- **Standards-based OIDC:** discovery via `/.well-known/openid-configuration`, authorization code flow, PKCE, `state` and `nonce` binding.
- **Token validation:** signature verification against the provider JWKS, `iss`, `aud`, `exp`, and `nonce` checks before trusting any claim.
- **Providers:** Keycloak, Authentik, Okta, Auth0, Microsoft Entra ID, Google Workspace, and any compliant OIDC IdP.
- **Account linking:** link an IdP identity to an existing account only when `email_verified` is true.
- **Per-workspace SSO:** register a provider per workspace, route sign-in by email domain, verify domain ownership via DNS, and provision users just-in-time.
- **Group mapping:** map IdP groups to `owner`, `editor`, `commenter`, or `viewer` through an admin-configured allowlist.
- **Enforced SSO:** workspace admins can require SSO, disable password login, and revoke sessions centrally.
- **Session security:** httpOnly, secure, same-site cookies; Redis-backed sessions; trusted-origin allowlist; CSRF protection; RP-initiated logout.
- **Sync authorization:** the gateway accepts only short-lived server-signed tokens; roles are resolved server-side.

---

## 🦀 Rust Backend Services

| Binary | Crate | Role |
| :--- | :--- | :--- |
| `office-engine-api` | `crates/api` | OIDC auth, documents, permissions, share links, templates, sync-token minting |
| `office-engine-sync` | `crates/sync` | WebSocket rooms, Loro relay, presence, snapshot writes |
| `office-engine-worker` | `crates/worker` | PDF/Office exports, thumbnails, email, compaction |
| `office-engine-engine` | `crates/engine` | Wasm layout, shaping, pagination, hit-testing |

- One Cargo workspace, one shared domain crate, one PostgreSQL schema.
- Native Loro server-side: snapshot validation, diffing, and compaction without a Node runtime.
- Axum + tokio + sqlx + Redis; static binaries, low memory, predictable tail latency.
- The API is stateless; the sync tier fans out over Redis pub/sub and scales independently.
- Nuxt 3 remains the UI and BFF only; it never queries the database directly.

---

## Architecture

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

Client-side (/editor/**):
  Hidden DOM input → Rust Wasm engine → paint descriptors → Skia 3-tier canvas
```

---

## The 4 Non-Negotiable Core Engine Pillars

| Pillar | Engineering Solution | Why It Matters |
| :--- | :--- | :--- |
| **1. The "Hidden DOM" Proxy** | Floating 1px × 1px `<textarea>` (`HiddenInput.vue`) | Captures keyboard events, clipboard shortcuts, and complex IME compositions (Chinese, Japanese, Korean, Vietnamese, emojis) while maintaining WCAG/ARIA screen reader accessibility. |
| **2. 3-Tier Layered Canvas** | Decoupled background, document surface, and overlay layers | Separates static paper margins and Skia text rendering from high-frequency caret blinking (60/120 FPS), eliminating redundant repaints. |
| **3. Spatial Hit-Testing** | 2D R-Tree index (`rbush` / `rstar`) | Maps mouse clicks `(x, y)` to logical text characters in microseconds ($O(\log N)$) without scanning the entire document. |
| **4. Asynchronous Layout** | Background workers / Rust Wasm threads via `SharedArrayBuffer` | Offloads paragraph wrapping, pagination, and sheet recalculation so live typing never drops a frame. |

---

## Tech Stack

| Domain | Technology | Role |
| :--- | :--- | :--- |
| **Engine Core** | **Rust** (Wasm via `wasm-pack`) | State management, text layout, shaping, and hit-testing |
| **State / CRDT** | **`loro`** (Rust) | Rich-text rope, sheet maps, slide scene graphs |
| **Graphics** | **`canvaskit-wasm`** (Google Skia) | Hardware-accelerated WebGL / WebGPU 2D rendering |
| **Text Shaping** | **`cosmic-text`** / HarfBuzz | OpenType font tables, ligatures, bidirectional text |
| **Spatial Index** | **`rbush`** / **`rstar`** | 2D R-tree spatial index for cursor hit-testing |
| **Frontend** | **Nuxt 3** (Vue 3 + TypeScript) | Application shell, toolbars, dialogs, BFF proxy |
| **API** | **Rust + axum + tokio** | Auth, OIDC, documents, permissions, templates |
| **Sync** | **Rust + axum WebSocket** | Room multiplexing, presence, CRDT relay |
| **Worker** | **Rust** | Export jobs, thumbnails, email, compaction |
| **Database** | **PostgreSQL 16+** + **PgBouncer** | Single source of truth in every environment |
| **DB Access** | **`sqlx`** (compile-time checked SQL) | Repositories, migrations, transactions |
| **Cache / Fan-out** | **Redis 7+** | Sessions, ACL cache, pub/sub, presence, rate limits |
| **Auth** | **`openidconnect` + `tower-sessions`** | OIDC discovery, PKCE, JWKS, sessions |
| **Object Storage** | **S3 / R2** | Exports, thumbnails, large binary attachments |
| **Styling** | **Tailwind CSS** | Clean, technical, high-density interface styling |

---

## Quick Start

### Docker (recommended)

The full stack runs in containers: PostgreSQL, Redis, Rust API, sync gateway, worker, Nuxt web, and Caddy as the single entry point.

```bash
cp .env.example .env   # optional; Compose ships safe local defaults
docker compose up --build
```

Open **http://localhost:8080**, then open **http://localhost:8080/editor/demo** to test typing. The API applies SQL migrations at boot.

Caddy routes:

- `/api/*` → Rust API (`crates/api`)
- `/ws` → sync gateway (`crates/sync`)
- everything else → Nuxt web (`apps/web`)

### OIDC

Set the `OIDC_*` variables in `.env` and restart. The redirect URL must match exactly:

```bash
OIDC_REDIRECT_URL=http://localhost:8080/api/auth/oidc/callback
```

### Tests in Docker

```bash
make test

# or individually
docker compose --profile test run --rm test
docker compose --profile test run --rm web-test
```

### Local development (optional)

Install Node.js ≥ 20, pnpm ≥ 9, Rust, `wasm-pack`, PostgreSQL 16+, and Redis 7+. Then set `WEB_ORIGIN=http://localhost:3000` and `NUXT_PUBLIC_SYNC_URL=ws://localhost:8081/ws` in `.env`, and run:

```bash
pnpm install
make wasm
docker compose up -d db redis
pnpm dev:api
pnpm dev:sync
pnpm dev
```

- **Web Application:** `http://localhost:3000`
- **API:** `http://localhost:8080`
- **Sync Gateway:** `ws://localhost:8081/ws`

---

## Workspace Commands

| Command | Action |
| :--- | :--- |
| `docker compose up --build` | Full stack in containers |
| `docker compose down -v` | Stop and remove volumes |
| `make test` | Rust and TypeScript checks in containers |
| `docker compose exec db psql -U office -d office_engine` | Open a PostgreSQL shell |
| `pnpm dev` | Nuxt 3 web application (local) |
| `pnpm dev:api` | Rust API service (local) |
| `pnpm dev:sync` | Rust WebSocket gateway (local) |
| `pnpm build:wasm` | Compile `crates/engine` to WebAssembly |
| `pnpm build` | Full production build (local) |
| `pnpm db:generate` | Generate a Drizzle migration from the web schema mirror |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm test` | Rust workspace tests + web tests (local) |

---

## Repository Structure

```
office-engine/
├── AGENTS.md                  # Authoritative agent rules and contracts
├── README.md                  # Project overview and quick start
├── ROADMAP.md                 # Engineering milestones
├── Cargo.toml                 # Rust workspace
├── Dockerfile.rust            # API / sync / worker image
├── docker-compose.yml         # Full stack: Postgres, Redis, Rust, web, Caddy
├── Caddyfile                  # Single-origin reverse proxy
├── Makefile                   # up / down / test / psql helpers
├── pnpm-workspace.yaml
├── package.json
│
├── crates/                    # RUST
│   ├── domain/                # Shared IDs, enums, DTOs, commands
│   ├── storage/               # sqlx pool, repositories, migrations
│   ├── auth/                  # OIDC, sessions, JWT, password hashing
│   ├── api/                   # axum HTTP API
│   ├── sync/                  # axum WebSocket gateway
│   ├── worker/                # Export and background jobs
│   └── engine/                # Wasm layout and rendering engine
│
├── apps/
│   ├── web/                   # Nuxt 3 application (UI + BFF)
│   │   ├── pages/             # Dashboard, editor routes by kind
│   │   ├── components/        # shared / docs / sheets / slides / draw
│   │   └── server/            # BFF handlers (no runtime DB access)
│   └── sync/                  # Legacy Node sync (deprecated; Rust is canonical)
│
└── reference/                 # Upstream references for algorithms
    ├── canvas-editor/
    └── cosmic-text/
```

---

## Security Model

- **Authentication:** OIDC authorization code flow with PKCE, `state`, and `nonce`; ID tokens validated against the provider JWKS.
- **Sessions:** Redis-backed, `HttpOnly; Secure; SameSite=Lax` cookies; trusted-origin allowlist.
- **Authorization:** document roles resolved server-side from `document_permissions` and `document_share_links`. Client-supplied roles are never trusted.
- **Sync gateway:** requires a short-lived JWT minted by the API; the token is scoped to one document and one role.
- **Viewers and commenters:** mutation frames are rejected at the gateway and logged.
- **Secrets:** OIDC client secrets and JWT signing keys live only in server environment variables, never in `NUXT_PUBLIC_*`.
- **Database:** PostgreSQL with per-service roles, PgBouncer, and least-privilege credentials.
- **Auditing:** security-relevant actions are appended to `document_activity_log`.

---

## License

MIT License. See `LICENSE` for details.
