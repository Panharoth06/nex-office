# ROADMAP.md — Office Engine

> The authoritative engineering roadmap for building a Google Docs-caliber collaborative canvas document engine with templates, granular sharing, and real-time co-authoring.

---

## Roadmap Overview

```
Phase 1: Canvas Core & MVP (W1–3)    ──► Phase 2: Auth & Templates (W4–5)  ──► Phase 3: Sharing & Permissions (W6–7)
  • Rust Wasm Engine Core                  • Better-Auth Self-Hosted Stack        • Direct User Invites (Roles)
  • 3-Tier Layered Canvas (Skia)           • Drizzle ORM Database Schema          • Public vs Restricted Share Links
  • Hidden IME Proxy Input                 • Template Gallery & 1-Click Clone     • Password & Expiration Controls
  • A4 Pagination & Wrapping               • Workspace Dashboard UI

Phase 4: Real-Time Sync (W8–9)       ──► Phase 5: Rich Blocks & Tables (W10–11) ──► Phase 6: Enterprise Interop (W12)
  • Dedicated Sync Server (:8080)          • Multi-page Tables (taffy)                • Native .docx Import/Export
  • Multi-user Presence Carets             • Inline & Floating Images                 • Client-side Vector PDF (typst.ts)
  • Loro CRDT Binary Streaming             • Headers, Footers & Margins               • WCAG 2.1 AA Screen Reader Tests
  • Debounced S3/DB Snapshots              • Drag-Selection Physics
```

---

## Phase 1: MVP Canvas Engine & Multi-Page Layout (Weeks 1–3)

**Objective:** Build the foundational canvas rendering pipeline capable of typing, formatting, and rendering multi-page A4 documents with zero latency.

- [x] **Monorepo Scaffold:** Setup pnpm workspace with Nuxt 3 (`apps/web`), sync service (`apps/sync`), and Rust core (`crates/engine`).
- [x] **Cloned References:** Curate `reference/canvas-editor` and `reference/cosmic-text` for algorithm lookups.
- [ ] **Loro CRDT Integration:** Initialize `LoroDoc` in Rust with rich-text inline attributes (`bold`, `italic`, `underline`, `fontSize`, `color`).
- [ ] **Google Skia Rendering:** Mount `canvaskit-wasm` on Layer 2 canvas, executing hardware-accelerated text draw calls on WebGL.
- [ ] **3-Tier Canvas Layout:** Decouple Paper background (Layer 1), Document text (Layer 2), and Dynamic overlay (Layer 3).
- [ ] **The "Hidden DOM" Proxy:** Wire up `HiddenInput.vue` to track caret position and handle English typing, CJK/Vietnamese IME composition, and backspace.
- [ ] **A4 Pagination Solver:** Wrap lines at the right margin ($96\text{ px}$) and split paragraphs across A4 pages ($794 \times 1123\text{ px}$).

**Acceptance Gate:** User can open a document, click anywhere, type smoothly via IME, format bold/italic text, and see text cleanly wrap across multiple A4 pages at 60 FPS.

---

## Phase 2: Users, Authentication & Template Gallery (Weeks 4–5)

**Objective:** Add complete user identity and a Google Docs-style template gallery.

- [x] **Database Schema Scaffold:** Drizzle ORM schema for `users`, `sessions`, `documents`, `document_templates`.
- [x] **Template Gallery UI:** Dashboard component displaying *Blank Document*, *Modern Resume*, *Project Proposal*, *Meeting Notes*, and *Formal Letter*.
- [ ] **Better-Auth Integration:** Setup email/password, magic link, and Google OAuth in Nuxt Nitro routes.
- [ ] **1-Click Template Cloning:** Implement backend endpoint `/api/templates/:id/clone` that copies a template's binary snapshot into a new document owned by the current user in $< 500\text{ ms}$.
- [ ] **User Custom Templates:** Allow users to flag any existing document as a reusable template in their workspace.

**Acceptance Gate:** Users can sign up, log in, view their personal workspace dashboard, and create new documents from pre-built templates.

---

## Phase 3: Google Docs Sharing & Permissions Engine (Weeks 6–7)

**Objective:** Replicate the exact two-tier Google Docs sharing and access control system.

- [x] **Share Modal UI:** Implemented `ShareModal.vue` with direct user invites and general access controls.
- [x] **Permissions Schema:** Tables for `document_permissions` (direct user roles) and `document_share_links` (link tokens).
- [ ] **Direct Access Enforcement:** Manage invites with explicit roles: `owner`, `editor`, `commenter`, `viewer`.
- [ ] **General Access Links:**
  - **Restricted:** Link requires an account matching the invited list.
  - **Anyone with the link:** Public access with configurable roles (`public_view`, `public_comment`, `public_edit`).
- [ ] **Link Security:** Support optional link passwords and automatic expiration dates.
- [ ] **Read-Only Viewer Mode:** When opened as `viewer`, the canvas disables cursor blinking, disables the hidden proxy input, and hides editing toolbars.

**Acceptance Gate:** An owner can generate a public view-only link, open it in an Incognito browser window, verify that text is visible but non-editable, and see live edits made by the owner appear instantly.

---

## Phase 4: Real-Time Multiplayer Collaboration & Presence (Weeks 8–9)

**Objective:** Enable smooth, real-time co-authoring with multi-user presence indicators.

- [x] **Sync Service Scaffold:** Setup dedicated WebSocket server in `apps/sync/src/index.ts` on port `:8080`.
- [ ] **Loro CRDT Binary Streaming:** Stream compact binary mutation deltas between connected peers via WebSockets.
- [ ] **Role Verification at Gateway:** Sync server verifies session or share link token on connection; blocks mutation packets from `viewer` connections.
- [ ] **Multi-User Presence Overlays:** Broadcast remote cursor coordinates `(x, y)` and active text selection ranges; render colored caret flags on Layer 3 at 60 FPS.
- [ ] **Debounced Snapshot Flushes:** Sync server periodically writes compressed snapshots to SQLite/PostgreSQL (`document_snapshots`) and S3/R2 storage every 500ms.

**Acceptance Gate:** Two independent browser sessions on the same document see each other's live cursor positions and can edit simultaneously with zero merge conflicts.

---

## Phase 5: Rich Content Blocks, Tables & Hit-Testing (Weeks 10–11)

**Objective:** Expand canvas capabilities to tables, images, and fluid drag-selection physics.

- [ ] **2D R-Tree Hit-Testing (`rbush` / `rstar`):** Map pointer clicks `(x, y)` to logical text characters in microseconds ($O(\log N)$).
- [ ] **Drag Selection Physics:** Draw multi-line selection highlight rectangles on Layer 3 during mouse drag.
- [ ] **Table Box Solver (`taffy`):** Implement table rows, columns, borders, and cell padding calculations.
- [ ] **Table Multi-Page Splitting:** Split large tables across page boundaries without truncating cell contents.
- [ ] **Inline Images & Floats:** Render inline images with bounding-box text wrapping.

**Acceptance Gate:** Users can drag-select text across paragraphs and pages, insert multi-page tables, and insert inline images with exact layout stability.

---

## Phase 6: Document Revision History & Enterprise Interop (Week 12)

**Objective:** Version control, file import/export, and enterprise compliance.

- [ ] **Revision History UI:** Sidebar showing all historical commits, timestamps, and author avatars.
- [ ] **1-Click Version Restore:** Revert document state to any previous snapshot.
- [ ] **Native `.docx` Import / Export:** High-fidelity conversion between Loro document AST and Microsoft Word `.docx`.
- [ ] **Client-Side Vector PDF:** Generate vector PDFs directly in background Web Workers using `typst.ts` or `pdf-lib`.
- [ ] **Accessibility (WCAG 2.1 AA):** Verify screen reader navigation (VoiceOver, NVDA) across document headings and paragraphs via the synchronized hidden DOM tree.

**Acceptance Gate:** Flawless round-trip import/export of `.docx` files, vector PDF generation, and complete revision history rollback.
