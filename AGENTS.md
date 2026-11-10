# AGENTS.md — Office Engine

> **Office Engine** is a full-featured, Google Docs-caliber collaborative document suite and canvas rendering engine. The core state, text shaping, layout, and pagination are written in **Rust** (compiled to WebAssembly via `wasm-pack`); the hardware-accelerated 2D rendering pipeline uses **Google Skia via CanvasKit-WASM** (WebGL/WebGPU); real-time collaboration is powered by a dedicated **WebSocket Sync Gateway + Loro CRDT**; and the full-stack application shell is built in **Nuxt 3 (Vue 3 + TypeScript + Tailwind CSS + Drizzle ORM + Better-Auth)**.

---

## Table of Contents

- [Architectural Blueprint](#architectural-blueprint)
- [Google Docs Feature Domains & Technical Contracts](#google-docs-feature-domains--technical-contracts)
  - [1. User Authentication & Workspaces](#1-user-authentication--workspaces)
  - [2. Template Engine & Gallery](#2-template-engine--gallery)
  - [3. Sharing & Access Control (Public vs. Private Links)](#3-sharing--access-control-public-vs-private-links)
  - [4. Real-Time Collaboration & Presence Engine](#4-real-time-collaboration--presence-engine)
  - [5. Document History & Revision Checkpoints](#5-document-history--revision-checkpoints)
- [The 4 Non-Negotiable Core Engine Pillars](#the-4-non-negotiable-core-engine-pillars)
- [Project Monorepo Structure](#project-monorepo-structure)
- [Database Schema Contract (Drizzle ORM)](#database-schema-contract-drizzle-orm)
- [Reference Repositories & Agent Lookup Directives](#reference-repositories--agent-lookup-directives)
- [Development, Build & Testing Guidelines](#development-build--testing-guidelines)
- [Acceptance Criteria & Finish Gate](#acceptance-criteria--finish-gate)

---

## Architectural Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NUXT 3 FULL-STACK WEB APP                                 │
│                                                                                        │
│  SSR / Nitro Server:                                                                   │
│    • Better-Auth: Email/Password, Sessions, Google OAuth                              │
│    • Drizzle ORM: Documents, Permissions, Share Links, Templates, Revisions            │
│    • SQLite (Local Dev) / PostgreSQL (Production)                                      │
│                                                                                        │
│  Client-Side SPA (/editor/**):                                                         │
│    • Toolbars, File Menu, Revision History, Share Modal                                │
│    • Hidden DOM Input Proxy (<textarea>): Intercepts IME, CJK, Emoji, a11y             │
│    • Viewport Virtualization: TanStack Virtual culls off-screen canvas pages           │
└───────────────────────────┬────────────────────────────────┬───────────────────────────┘
                            │ Keystrokes & Pointer Events    │ Binary CRDT Mutations (WS)
┌───────────────────────────▼────────────────────────────┐   ▼
│                  HIGH-PERFORMANCE CORE                 │ ┌─────────────────────────────┐
│                 (Rust / WebAssembly)                   │ │   DEDICATED SYNC SERVER     │
│                                                        │ │   (@office-engine/sync)     │
│  State & CRDT Model:   Loro CRDT (Rope + Spans)        │ │                             │
│  Text Shaping:         cosmic-text / HarfBuzz (Wasm)   │ │  • WebSocket Port :8080     │
│  Line-Breaking:        Unicode UAX #14 + Knuth-Plass   │ │  • Room multiplexing        │
│  Box Layout & Flow:    taffy (Flexbox & Table math)    │ │  • Role verification        │
│  Spatial Hit-Testing:  2D R-Tree (rbush / rstar)       │ │  • Awareness & cursors      │
└───────────────────────────┬────────────────────────────┘ │  • Redis clustering         │
                            │ Paint Descriptors            │  • Debounced S3/DB flushes  │
┌───────────────────────────▼────────────────────────────┐ └─────────────────────────────┘
│               3-TIER LAYERED CANVAS                    │
│                                                        │
│  Layer 1 (Bottom): Static Paper, Margins (Cached)      │
│  Layer 2 (Middle): Document Glyphs & Tables (Skia)     │
│  Layer 3 (Top):    Caret Blinking & Presence Overlays  │
└────────────────────────────────────────────────────────┘
```

---

## Google Docs Feature Domains & Technical Contracts

### 1. User Authentication & Workspaces
- **Technology:** Self-hosted **Better-Auth** integrated directly into Nuxt 3 Nitro.
- **Identity Features:** Email/Password, Magic Link, Google OAuth, session cookies.
- **Workspaces:** Documents are owned by an author (`owner_id`) and belong to a personal or team workspace.
- **Rule for Agents:** Never implement hardcoded mock users in production routes. All document mutations must be tied to an authenticated `userId` or validated guest token.

### 2. Template Engine & Gallery
- **System Templates:** Curated pre-bundled documents (Blank Document, Modern Resume, Project Proposal, Executive Meeting Notes, Formal Letter).
- **User Custom Templates:** Any document can be flagged with `is_template = true` or saved to the workspace template gallery.
- **Instantiation Contract:** When a user clicks "Use Template", the system **clones** the template's binary snapshot (`loro_binary`), generates a new UUID, sets the current user as `owner`, and opens the editor immediately.
- **Storage:** Stored in `document_templates` table with metadata and preview thumbnail.

### 3. Sharing & Access Control (Public vs. Private Links)
The system strictly enforces the **Google Docs Two-Tier Access Model**:
1. **Direct People & Group Sharing (`document_permissions`):**
   - Invite users by email with explicit roles: `owner`, `editor`, `commenter`, `viewer`.
   - Owners can transfer ownership or revoke access at any time.
2. **General Access / Link Sharing (`document_share_links`):**
   - **Restricted:** Only explicitly invited users can open the link.
   - **Anyone with the link:** Public access with configurable capability:
     - `public_view`: Read-only. Canvas renders text; hidden input is disabled; cursors are hidden.
     - `public_comment`: Read and comment. Cannot mutate document body text.
     - `public_edit`: Full collaborative editing without requiring an account.
   - **Security Enhancements:** Optional password hash (`password_hash`) and expiration timestamps (`expires_at`).
- **Rule for Agents:** The WebSocket sync server must validate the user's role on connection. If a user is a `viewer`, all incoming mutation packets must be rejected and logged.

### 4. Real-Time Collaboration & Presence Engine
- **Technology:** Dedicated standalone service (`apps/sync`) running on port `:8080`, backed by `loro-crdt` binary replication and optional Redis clustering.
- **Awareness Protocol:**
  - Multi-user caret coordinates `(x, y)` and active text selections are broadcast as lightweight ephemerals (not persisted in document history).
  - Each collaborator is assigned a unique name and color avatar rendered on Layer 3 overlay.
- **Snapshot Persistence:** The sync server periodically debounces (500ms) full document state snapshots to SQLite/PostgreSQL (`document_snapshots` table) and S3/R2 storage.

### 5. Document History & Revision Checkpoints
- **Incremental Commits:** Every user typing burst triggers a Loro CRDT commit tagged with timestamp and author ID.
- **Named Revisions:** Users can name milestones (e.g., "Draft v1 - Approved by Legal").
- **Time Travel & Restore:** The client can load any historical snapshot into a read-only canvas preview and perform a one-click rollback.

---

## The 4 Non-Negotiable Core Engine Pillars

Every agent and engineer must follow these rules without exception:

### 1. The "Hidden DOM" Input Illusion
- `<canvas>` has no native keyboard focus, caret blinking, clipboard shortcuts, or Input Method Editor (IME) support for Chinese, Japanese, Korean, Vietnamese, or emojis.
- **Rule:** Never attach raw `keydown` listeners to the `<canvas>` element for typing.
- **Implementation:** Always float an invisible 1px $\times$ 1px `<textarea>` (`HiddenInput.vue`) positioned synchronously under the active canvas cursor. The textarea intercepts keystrokes, clipboard paste, and IME composition events (`compositionstart`, `compositionupdate`, `compositionend`), forwards them to the Rust engine, and updates the accessible DOM tree for screen readers (ARIA / WCAG compliance).

### 2. 3-Tier Layered Canvas Rendering
- Never repaint the entire document or redraw heavy text paragraphs on a cursor blink or selection drag.
- **Rule:** Decouple canvas surfaces into three distinct vertical layers:
  - **Layer 1 (Bottom — Static Paper):** Page borders, shadows, headers, footers. Painted once; cached as GPU textures.
  - **Layer 2 (Middle — Document Surface):** Text glyph runs, inline images, tables rendered via **Google Skia (`canvaskit-wasm`)**. Only repainted when document content mutates.
  - **Layer 3 (Top — Dynamic Overlay):** Blinking caret, drag-selection blue rectangles, and remote collaborator presence tags. Redraws at 60/120 FPS without repainting Layer 1 or 2.

### 3. Sub-Millisecond Spatial Hit-Testing ($O(\log N)$)
- Never loop linearly through all words in a document to find where a user clicked.
- **Rule:** Register all rendered `LineBox` and `GlyphRun` bounding boxes in a 2D spatial **R-Tree** (`rbush` / `rstar`).
- On mouse click `(x, y)`, the R-Tree queries candidate line boxes in $< 0.1\text{ ms}$, followed by a binary search across character bounds to find the exact character insertion index.

### 4. Asynchronous Background Layout (Zero UI Freezes)
- Text measurement, line wrapping, and multi-page A4 splitting for large documents (100+ pages) must never execute synchronously on the main JavaScript thread during user typing.
- Heavy layout tasks run in background Web Workers or Rust Wasm threads using `SharedArrayBuffer`.

---

## Project Monorepo Structure

```
office-engine/
├── AGENTS.md                  # ← Authoritative agent instructions & rules (You are here)
├── README.md                  # ← Project overview, quick start, architecture
├── ROADMAP.md                 # ← 5-phase engineering roadmap
├── pnpm-workspace.yaml        # Monorepo configuration
├── package.json               # Monorepo root scripts
├── Cargo.toml                 # Rust workspace root
│
├── crates/                    # RUST CORE (Wasm compiled via wasm-pack)
│   └── engine/
│       ├── Cargo.toml         # Dependencies: loro, wasm-bindgen, taffy, serde
│       └── src/
│           ├── lib.rs         # Wasm exported interface (EngineCore)
│           ├── document.rs    # Loro CRDT document model wrapper
│           ├── layout.rs      # A4 page dimensions, LineBox, Box tree
│           └── text.rs        # Text shaping and glyph runs
│
├── apps/
│   ├── web/                   # NUXT 3 FULL-STACK APPLICATION
│   │   ├── nuxt.config.ts     # Hybrid SSR: ssr: false for /editor/**
│   │   ├── package.json       # Dependencies: canvaskit-wasm, drizzle-orm, better-auth
│   │   ├── app.vue            # Root app template
│   │   ├── pages/
│   │   │   ├── index.vue      # Document dashboard & template gallery
│   │   │   └── editor/
│   │   │       └── [id].vue   # Canvas document workspace
│   │   ├── server/
│   │   │   └── database/
│   │   │       └── schema.ts  # Drizzle ORM schema (Users, Docs, Shares, Templates)
│   │   └── components/
│   │       ├── dashboard/
│   │       │   └── TemplateGallery.vue # Gallery (Resume, Notes, Proposal, Blank)
│   │       └── editor/
│   │           ├── CanvasSurface.vue   # 3-tier Skia canvas coordinator
│   │           ├── HiddenInput.vue     # Proxy textarea for IME & a11y
│   │           ├── Toolbar.vue         # Formatting controls & collaborator avatars
│   │           └── ShareModal.vue      # Google Docs sharing modal (Public/Private)
│   │
│   └── sync/                  # DEDICATED WEBSOCKET COLLABORATION SERVICE
│       ├── package.json       # Dependencies: ws, loro-crdt, ioredis
│       └── src/
│           └── index.ts       # Real-time room multiplexing, presence & auth gates
│
└── reference/                 # BATTLE-TESTED OPEN-SOURCE REFERENCES
    ├── canvas-editor/         # TypeScript canvas document editor (Hufe921)
    └── cosmic-text/           # Pure Rust text shaping & font engine
```

---

## Database Schema Contract (Drizzle ORM)

All database operations must conform to [`apps/web/server/database/schema.ts`](file:///Users/macbook/Code/office-engine/apps/web/server/database/schema.ts):

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `users` | User accounts | `id`, `name`, `email`, `image`, `created_at` |
| `sessions` | Active login sessions | `id`, `token`, `user_id`, `expires_at` |
| `documents` | Core document entities | `id`, `title`, `owner_id`, `is_template`, `thumbnail` |
| `document_permissions` | Direct access list | `document_id`, `user_id`, `role` (`owner` \| `editor` \| `commenter` \| `viewer`) |
| `document_share_links` | General link access | `document_id`, `access_type` (`restricted` \| `public_view` \| `public_comment` \| `public_edit`), `secret_token`, `password_hash`, `expires_at` |
| `document_templates` | Reusable templates | `id`, `title`, `category`, `snapshot_data`, `is_system` |
| `document_snapshots` | Version history | `document_id`, `version`, `author_id`, `loro_binary`, `created_at` |

---

## Reference Repositories & Agent Lookup Directives

When building features, **never guess or invent canvas geometry algorithms from scratch**. Consult the cloned references in `reference/`:

| Subsystem | Reference Directory | Specific Files to Study |
| :--- | :--- | :--- |
| **IME & Keyboard Input** | `reference/canvas-editor` | `src/editor/core/listener/Keydown.ts`, `Input.ts`, `Composition.ts` |
| **Cursor & Hit-Testing** | `reference/canvas-editor` | `src/editor/core/position/Position.ts`, `Range.ts` |
| **Page Splitting (A4)** | `reference/canvas-editor` | `src/editor/core/draw/frame/` (Line and page splitting math) |
| **Rust Text Shaping** | `reference/cosmic-text` | `src/buffer.rs`, `src/font.rs`, `src/shape.rs` |
| **BiDi & Complex Scripts** | `reference/cosmic-text` | `src/bidi.rs` (Arabic / Hebrew bidirectional handling) |

---

## Development, Build & Testing Guidelines

### 1. Code Style & Modularity
- **Concise Files:** Keep source files focused and modular (target $\le 250$ lines, hard ceiling of 350 lines). Never write monolithic 1,000+ line files.
- **Strict TypeScript:** Strict mode enabled. No `any` types unless interfacing with raw WebAssembly pointers.
- **Idiomatic Rust:** Pure Rust without `unsafe` blocks unless interfacing with low-level WebAssembly memory buffers. Always handle errors explicitly with `Result`.

### 2. Workspace Commands
- **Install dependencies:** `pnpm install`
- **Run frontend dev server:** `pnpm dev`
- **Run sync server:** `pnpm dev:sync`
- **Run both in parallel:** `pnpm dev:all`
- **Build Rust Wasm engine:** `pnpm build:wasm`
- **Build entire production stack:** `pnpm build`

---

## Acceptance Criteria & Finish Gate

Every PR or agent milestone must satisfy these conditions:
1. **Multi-Page A4 Canvas:** Renders distinct A4 pages with margins, page numbers, and drop shadows.
2. **Smooth IME & Caret Typing:** Clicking anywhere focuses the hidden proxy input; typing Chinese, Japanese, or English updates the caret without jumping.
3. **Template Instantiation:** Selecting a template in the dashboard clones its snapshot and opens a ready-to-edit document in $< 500\text{ ms}$.
4. **Link Sharing Parity:** Generating a "Public Viewer" link allows opening the document in an Incognito window in read-only mode with mutations disabled.
5. **Real-Time Multiplayer Sync:** Multiple browser tabs on the same document broadcast live caret positions and Loro CRDT text changes at 60 FPS.
