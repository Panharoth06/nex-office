# Office Engine

> A high-performance, canvas-rendered collaborative document engine built with **Rust (WebAssembly)**, **Google Skia (`canvaskit-wasm`)**, and **Nuxt 3**.

---

## Overview

**Office Engine** is designed from the ground up to achieve Google Docs-level typing performance, typography fidelity, and responsiveness. Instead of relying on traditional HTML DOM editing (`contenteditable`), which suffers from browser layout thrashing and garbage-collection stutters on large documents, Office Engine renders text and document elements directly onto a hardware-accelerated WebGL/WebGPU surface.

### Key Architectural Highlights
- **Deterministic 60/120 FPS Performance:** Document state, text layout, and pagination are executed in a high-speed **Rust** core compiled to WebAssembly.
- **Hardware-Accelerated Google Skia Rendering:** Uses `canvaskit-wasm` (the exact C++ 2D graphics engine powering Chrome and Flutter) for identical subpixel rendering across all operating systems.
- **The "Hidden DOM" Input Proxy:** Transparently supports multi-language Input Method Editors (IME for Chinese, Japanese, Korean, Vietnamese), complex emojis, native clipboard shortcuts, and screen readers.
- **3-Tier Layered Canvas:** Decouples static page margins, middle document text runs, and high-frequency caret/selection overlays.
- **Sub-Millisecond Hit-Testing:** Uses a 2D spatial **R-Tree** (`rbush` / `rstar`) to resolve pointer clicks `(x, y)` to character indices in microseconds ($O(\log N)$).

---

## Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Engine Core** | **Rust** (Wasm via `wasm-pack`) | Fast text shaping, layout calculation, and memory-safe multithreading |
| **Document State** | **`loro`** (Rust CRDT) | B-tree/Rope document buffer supporting rich-text formatting spans |
| **Graphics Engine** | **`canvaskit-wasm`** (Google Skia) | WebGL / WebGPU 2D rasterization engine |
| **Text Shaping** | **`cosmic-text`** / **`rustybuzz`** | OpenType font shaping, ligatures, and bidirectional RTL text (HarfBuzz) |
| **Box Layout** | **`taffy`** (Rust/Wasm) | Flexbox, grid, and block coordinate layout solver |
| **Spatial Index** | **`rbush`** / **`rstar`** | 2D R-Tree spatial index for mouse selection hit-testing |
| **Application Shell** | **Nuxt 3** (Vue 3 + TypeScript) | File dashboard, toolbars, menus, dialogs, and Nitro server backend |
| **Styling** | **Tailwind CSS** | Modern utility-first styling for application chrome |

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                   NUXT 3 FRONTEND                      │
│       • Application Chrome (Toolbars, Menus, Dialogs)  │
│       • Hidden Input Proxy (<textarea>): IME & a11y    │
│       • Page Virtualization: Mounts visible pages only │
└───────────────────────────┬────────────────────────────┘
                            │ Pointer Events & Keystrokes
┌───────────────────────────▼────────────────────────────┐
│                  RUST ENGINE CORE (Wasm)               │
│                                                        │
│  State:           Loro CRDT (Rope buffer with spans)   │
│  Text Shaping:    cosmic-text (HarfBuzz OpenType)      │
│  Line Breaking:   Unicode UAX #14 + Knuth-Plass        │
│  Box Layout:      taffy (Flexbox & Table math)         │
│  Hit-Testing:     2D R-Tree (O(log N) coordinate map)  │
└───────────────────────────┬────────────────────────────┘
                            │ Paint Descriptors
┌───────────────────────────▼────────────────────────────┐
│              3-TIER LAYERED CANVAS (Skia)              │
│                                                        │
│  Layer 1 (Bottom): Static Paper, Margins, Shadows      │
│  Layer 2 (Middle): Document Glyphs, Images, Tables     │
│  Layer 3 (Top):    Caret Blinking, Selection Rects     │
└────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- **Node.js** $\ge 20$
- **pnpm** $\ge 9$
- **Rust toolchain** (`rustup`, `cargo`, `wasm-pack`) — *required for compiling the Rust Wasm engine*

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/office-engine.git
cd office-engine

# Install Node dependencies
pnpm install

# Start the Nuxt 3 development server
pnpm dev
```

Visit `http://localhost:3000` to open the document workspace.

### Building the Rust WebAssembly Engine

```bash
# Build the engine crate into WebAssembly
pnpm build:wasm
```

---

## Repository Structure

```
office-engine/
├── AGENTS.md                  # Comprehensive AI agent instructions and finish gates
├── README.md                  # Project overview and architecture documentation
├── ROADMAP.md                 # 5-phase engineering roadmap
├── pnpm-workspace.yaml        # Monorepo configuration
├── Cargo.toml                 # Rust workspace configuration
├── crates/
│   └── engine/                # Rust Wasm core (Loro CRDT, shaping, layout)
├── apps/
│   └── web/                   # Nuxt 3 application shell (toolbars, canvas host)
└── reference/                 # Battle-tested open-source reference implementations
    ├── canvas-editor/         # TypeScript canvas document editor reference (Hufe921)
    └── cosmic-text/           # Rust text shaping & font layout reference
```

---

## Reference Implementations

The repository includes curated reference codebases in `reference/` for inspecting battle-tested algorithms:
- **`reference/canvas-editor`**: Studied for IME textarea synchronization, cursor positioning, and selection range mapping.
- **`reference/cosmic-text`**: Studied for pure-Rust OpenType font shaping, fallback, and bidirectional text flow.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
