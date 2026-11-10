# AGENTS.md — Office Engine

> **Office Engine** is a Google Docs-caliber, high-performance canvas document editor. The core state, text shaping, layout, and pagination engine are written in **Rust** (compiled to WebAssembly via `wasm-pack`); the hardware-accelerated 2D rendering pipeline uses **Google Skia via CanvasKit-WASM** (WebGL/WebGPU); and the user application shell is built in **Nuxt 3 (Vue 3 + TypeScript + Tailwind CSS)**.

---

## Table of Contents

- [Architectural Contract](#architectural-contract)
- [The 4 Non-Negotiable Engineering Pillars](#the-4-non-negotiable-engineering-pillars)
- [Project Structure](#project-structure)
- [Reference Repositories & Agent Lookup Directives](#reference-repositories--agent-lookup-directives)
- [Development & Build Guidelines](#development--build-guidelines)
- [Testing & Quality Gates](#testing--quality-gates)
- [Phase 1 MVP Scope & Acceptance Criteria](#phase-1-mvp-scope--acceptance-criteria)

---

## Architectural Contract

```
┌────────────────────────────────────────────────────────────────────────┐
│                   NUXT 3 APPLICATION SHELL (TypeScript)                │
│       • Toolbars, Menus, Dialogs, Sidebar (SSR/Nitro)                  │
│       • Hidden Input Proxy (<textarea>): IME, Keyboard, a11y           │
│       • Viewport Virtualization: Mounts only visible pages             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Events & Paint Coordinates
┌───────────────────────────────────▼────────────────────────────────────┐
│                  HIGH-PERFORMANCE CORE (Rust / Wasm)                   │
│                                                                        │
│  State & CRDT Model:        Loro (Rust CRDT rope with rich-text spans) │
│  Text Shaping & Fallback:   cosmic-text / rustybuzz (HarfBuzz)         │
│  Line-Breaking Engine:      Unicode UAX #14 + Knuth-Plass algorithm    │
│  2D Box Layout & Flow:      taffy (Flexbox/Grid/Table geometries)      │
│  Spatial Hit-Testing:       2D R-Tree (rbush / rstar, O(log N) clicks) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Glyph IDs & Bounding Boxes
┌───────────────────────────────────▼────────────────────────────────────┐
│                3-TIER HARDWARE-ACCELERATED CANVAS                      │
│                                                                        │
│  Layer 1 (Bottom): Page margins, background, drop-shadows (Cached)     │
│  Layer 2 (Middle): Document glyphs, images, tables (Skia WebGL)        │
│  Layer 3 (Top):    Caret blinking, selections, presence (60/120 FPS)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## The 4 Non-Negotiable Engineering Pillars

Every agent and human contributor working on this codebase must adhere to these 4 principles:

### 1. The "Hidden DOM" Input Illusion
- `<canvas>` has no native keyboard focus, caret blinking, clipboard shortcuts, or Input Method Editor (IME) support for Chinese, Japanese, Korean, Vietnamese, or emojis.
- **Rule:** Never attempt to capture text input by attaching raw `keydown` listeners to the `<canvas>` element.
- **Implementation:** Always float an invisible 1px $\times$ 1px `<textarea>` (`HiddenInput.vue`) positioned synchronously under the active canvas cursor. The textarea intercepts keystrokes, clipboard paste, and IME composition events (`compositionstart`, `compositionupdate`, `compositionend`), synchronizes with the Rust engine, and updates the accessible DOM tree for screen readers.

### 2. 3-Tier Layered Canvas Rendering
- Never repaint the entire document or redraw heavy text paragraphs on a cursor blink or selection drag.
- **Rule:** Decouple canvas surfaces into three distinct vertical layers:
  - **Layer 1 (Static Paper):** Page borders, shadows, headers, footers. Painted once; cached as GPU textures.
  - **Layer 2 (Document Surface):** Text glyph runs, inline images, tables rendered via **Google Skia (`canvaskit-wasm`)**. Only repainted when document content mutates.
  - **Layer 3 (Dynamic Overlay):** Blinking caret, drag-selection blue rectangles, and remote collaborator presence tags. Redraws freely at 60/120 FPS without repainting Layer 1 or 2.

### 3. Sub-Millisecond Spatial Hit-Testing ($O(\log N)$)
- Never loop linearly through all words in a document to find where a user clicked.
- **Rule:** Register all rendered `LineBox` and `GlyphRun` bounding boxes in a 2D spatial **R-Tree** (`rbush` / `rstar`).
- On mouse click `(x, y)`, the R-Tree queries candidate line boxes in $< 0.1\text{ ms}$, followed by a binary search across character bounds to find the exact character insertion index.

### 4. Asynchronous Background Layout (Zero UI Freezes)
- Text measurement, line wrapping, and multi-page A4 splitting for large documents (100+ pages) must never execute synchronously on the main JavaScript thread during user typing.
- Heavy layout tasks run in background Web Workers or Rust Wasm threads using `SharedArrayBuffer`.

---

## Project Structure

```
office-engine/
├── AGENTS.md                  # ← Authoritative agent instructions & rules (You are here)
├── README.md                  # ← Project overview, quick start, architecture
├── ROADMAP.md                 # ← 5-phase engineering roadmap
├── pnpm-workspace.yaml        # Monorepo configuration
├── package.json               # Monorepo root scripts
├── Cargo.toml                 # Rust workspace root
├── crates/                    # RUST CORE (Wasm compiled via wasm-pack)
│   └── engine/
│       ├── Cargo.toml         # Dependencies: loro, wasm-bindgen, taffy, serde
│       └── src/
│           ├── lib.rs         # Wasm exported interface (EngineCore)
│           ├── document.rs    # Loro CRDT document model wrapper
│           ├── layout.rs      # A4 page dimensions, LineBox, Box tree
│           └── text.rs        # Text shaping and glyph runs
├── apps/
│   └── web/                   # NUXT 3 APPLICATION SHELL
│       ├── nuxt.config.ts     # Hybrid SSR: ssr: false for /editor/**
│       ├── package.json       # Dependencies: canvaskit-wasm, rbush, tailwind
│       ├── app.vue            # Root app template
│       ├── pages/
│       │   ├── index.vue      # Document dashboard & file list
│       │   └── editor/
│       │       └── [id].vue   # Canvas document workspace
│       └── components/
│           └── editor/
│               ├── CanvasSurface.vue  # 3-tier Skia canvas coordinator
│               ├── HiddenInput.vue    # Proxy textarea for IME & a11y
│               └── Toolbar.vue        # Formatting controls
└── reference/                 # BATTLE-TESTED OPEN-SOURCE REFERENCES
    ├── canvas-editor/         # TypeScript canvas document editor (Hufe921)
    └── cosmic-text/           # Pure Rust text shaping & font engine
```

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

## Development & Build Guidelines

### 1. Code Style & Modularity
- **Concise Files:** Keep source files focused and modular (target $\le 250$ lines, hard ceiling of 350 lines). Never write monolithic 1,000+ line files.
- **Strict TypeScript:** Strict mode enabled. No `any` types unless interfacing with raw WebAssembly pointers.
- **Idiomatic Rust:** Pure Rust without `unsafe` blocks unless interfacing with low-level WebAssembly memory buffers. Always handle errors explicitly with `Result`.

### 2. Workspace Commands
- **Install dependencies:** `pnpm install`
- **Run frontend dev server:** `pnpm dev`
- **Build Rust Wasm engine:** `pnpm build:wasm` (requires Rust toolchain and `wasm-pack`)
- **Build production app:** `pnpm build`

---

## Phase 1 MVP Scope & Acceptance Criteria

To complete Phase 1 MVP, the engine must fulfill these criteria:
1. **Multi-Page Canvas Rendering:** Renders 1–5 A4 document pages ($794 \times 1123\text{ px}$ at 96 DPI) with drop shadows and page gaps.
2. **Smooth Typing via Hidden Proxy Input:** Users can click anywhere on the page, receive a blinking caret at the correct coordinate, and type English, Chinese/Japanese IME, or emojis without caret jumping.
3. **Rich Text Formatting:** Bold, italic, font size, and text color mutations applied via Loro CRDT spans.
4. **Deterministic Line & Page Breaking:** Text wraps cleanly when reaching the right margin ($96\text{ px}$) and spills into a new A4 page when exceeding the bottom margin.
5. **60 FPS Rendering:** Zero UI stutter during active typing on desktop browsers.
