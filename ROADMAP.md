# ROADMAP.md — Office Engine

> The authoritative engineering roadmap for building a Google Docs-caliber collaborative canvas document engine.

---

## Roadmap Overview

```
Phase 1: MVP Core (W1–3)      ──► Phase 2: Rich Blocks (W4–6)   ──► Phase 3: Interaction & a11y (W7–8)
  • Rust Wasm Core              • Tables & Cell Splitting          • 2D R-Tree Hit-Testing
  • Loro CRDT State             • Inline Images & Floats           • Drag Selection Physics
  • 3-Tier Skia Canvas          • Header, Footer & Margins         • Clipboard & History Stack
  • Hidden IME Input Proxy

Phase 4: Real-Time Collab (W9–10)  ──► Phase 5: File Interop & Enterprise (W11–12)
  • WebSocket Rooms (Hocuspocus)        • Native .docx Import/Export
  • Multi-user Presence Carets          • Vector PDF Generation (typst.ts)
  • S3 / PostgreSQL Snapshots           • Offline-first IndexedDB Caching
```

---

## Phase 1: MVP Core Engine & Multi-Page Canvas (Weeks 1–3)

**Objective:** Build the foundational pipeline capable of typing, formatting, and rendering multi-page A4 documents with zero latency.

- [x] **Repository Scaffold:** Setup monorepo with Nuxt 3 frontend and Rust Wasm core crate.
- [x] **Cloned References:** Curate `reference/canvas-editor` and `reference/cosmic-text` for algorithm lookups.
- [ ] **Loro CRDT Integration:** Initialize `LoroDoc` in Rust with rich-text inline attributes (`bold`, `italic`, `underline`, `fontSize`, `color`).
- [ ] **Google Skia Rendering:** Mount `canvaskit-wasm` on Layer 2 canvas, executing hardware-accelerated text draw calls on WebGL.
- [ ] **3-Tier Canvas Layout:** Decouple Paper background (Layer 1), Document text (Layer 2), and Dynamic overlay (Layer 3).
- [ ] **The "Hidden DOM" Proxy:** Wire up `HiddenInput.vue` to track caret position and handle English typing, CJK/Vietnamese IME composition, and backspace.
- [ ] **A4 Pagination Solver:** Wrap lines at the right margin ($96\text{ px}$) and split paragraphs across A4 pages ($794 \times 1123\text{ px}$).

**Acceptance Gate:** User can open a document, click anywhere, type smoothly via IME, format bold/italic text, and see text cleanly wrap across multiple A4 pages at 60 FPS.

---

## Phase 2: Rich Content, Tables & Layout Blocks (Weeks 4–6)

**Objective:** Support structured document primitives beyond plain paragraphs.

- [ ] **Table Box Solver (`taffy`):** Implement table rows, columns, borders, and padding calculations.
- [ ] **Table Page-Splitting:** Split multi-row tables across page boundaries without truncating cell contents.
- [ ] **Inline Images:** Insert and scale bitmap images with automatic line height adjustments.
- [ ] **Floating Images & Text Wrap:** Implement bounding-polygon text wrap around images.
- [ ] **Headers, Footers & Page Numbers:** Dedicated layout zones on Layer 1 with dynamic page numbering variables (`Page X of Y`).

**Acceptance Gate:** Documents can render multi-page tables and inline images with exact Microsoft Word layout consistency.

---

## Phase 3: Spatial Hit-Testing, Selection & Clipboard (Weeks 7–8)

**Objective:** Provide responsive, fluid mouse and keyboard interactions matching Google Docs.

- [ ] **2D R-Tree Spatial Index:** Integrate `rbush` or `rstar` to index all rendered line boxes and word runs.
- [ ] **Microsecond Hit-Testing:** Resolve pointer clicks `(x, y)` to logical text character indices in $< 0.1\text{ ms}$.
- [ ] **Drag Selection Physics:** Draw multi-line selection rectangles on Layer 3 overlay during mouse drag.
- [ ] **Clipboard Pipeline:** Intercept `copy`, `cut`, and `paste` to serialize/deserialize both plain text and rich HTML/JSON formats.
- [ ] **Undo / Redo Stack:** Transactional history management backed by Loro CRDT commit checkpoints.

**Acceptance Gate:** Smooth click-and-drag selection across lines and pages, multi-level undo/redo, and native system copy-paste support.

---

## Phase 4: Real-Time Multiplayer Collaboration (Weeks 9–10)

**Objective:** Enable frictionless Google Docs-style real-time co-authoring.

- [ ] **WebSocket Gateway:** Deploy `Hocuspocus` or `y-sweet` sync server with Redis clustering.
- [ ] **Binary CRDT Replication:** Stream compact binary mutation deltas between clients via WebSockets.
- [ ] **Multi-User Presence Cursors:** Render remote collaborators' names, color tags, and live selections on Layer 3 at 60 FPS.
- [ ] **Offline Resilience:** Store local document snapshots in browser IndexedDB with automatic reconciliation upon reconnecting.
- [ ] **Server Persistence:** Debounced 500ms snapshot flushes to PostgreSQL (metadata) and S3 (binary CRDT blobs).

**Acceptance Gate:** Two independent browser windows can edit the same paragraph concurrently with zero merge conflicts or dropped frames.

---

## Phase 5: High-Fidelity File Interop & Enterprise Polish (Weeks 11–12)

**Objective:** Enterprise file compatibility, export, and production readiness.

- [ ] **Native `.docx` Export:** Walk the Loro document AST and generate valid OpenXML Word documents via `docx`.
- [ ] **Native `.docx` Import:** Parse uploaded `.docx` files using `mammoth.js` or custom AST translator.
- [ ] **Client-Side Vector PDF:** Compile vector PDF export in background Web Worker using `typst.ts` or `pdf-lib`.
- [ ] **Print Pipeline:** Generate high-DPI (300 DPI) print-ready raster or vector output matching on-screen layout.
- [ ] **WCAG 2.1 AA Accessibility:** Verify complete screen reader accessibility (NVDA, VoiceOver) via the synchronized hidden DOM tree.

**Acceptance Gate:** Flawless round-trip export of `.docx` and vector `.pdf`, zero visual degradation on high-DPI print, and 100% accessible navigation.
