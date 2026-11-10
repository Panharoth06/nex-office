# Office Engine

> A high-performance, Google Docs-caliber collaborative document suite and canvas rendering engine built with **Rust (WebAssembly)**, **Google Skia (`canvaskit-wasm`)**, **Loro CRDT**, and **Nuxt 3**.

---

## Overview

**Office Engine** is a full-featured collaborative document editing platform designed to deliver Google Docs parity in performance, typography fidelity, and real-time multiplayer co-authoring.

Unlike standard web document editors that rely on HTML DOM editing (`contenteditable`)—which causes browser layout thrashing, DOM bloat, and garbage-collection stutters on long documents—Office Engine runs a dedicated **Rust layout and text engine** that paints text and document elements onto a hardware-accelerated WebGL/WebGPU surface.

---

## ✨ Google Docs-Caliber Feature Suite

### 📄 1. Template Gallery & Custom Templates
- **Curated System Templates:** Instantly start documents with pre-designed templates: *Modern Resume*, *Project Proposal*, *Executive Meeting Notes*, *Formal Letter*, or *Blank A4*.
- **User Custom Templates:** Save any document to your workspace template gallery.
- **Instant 1-Click Instantiation:** Creating from a template clones the template's binary snapshot (`loro_binary`) into an independent document in under 500ms.

### 🔒 2. Sharing & Access Control (Public vs. Private Links)
Full parity with the Google Docs sharing model:
- **Direct User Invites:** Share with specific users or teams via email with explicit roles:
  - **Owner:** Full administrative authority, transfer ownership, delete document.
  - **Editor:** Mutate document text, layout, and formatting.
  - **Commenter:** View document and place comment anchors; cannot mutate text.
  - **Viewer:** Read-only access; typing and canvas carets are locked.
- **General Access (Link Sharing):**
  - **Restricted:** Only explicitly invited email addresses can open the link.
  - **Anyone with the link:** Public access with configurable roles (`Viewer`, `Commenter`, `Editor`).
  - **Link Security:** Optional password protection and automatic expiration timestamps.

### 👥 3. Real-Time Multiplayer Collaboration
- **Decentralized CRDT:** Powered by **Loro CRDT**, guaranteeing deterministic peer-to-peer merge resolution with zero central transformation bottleneck.
- **Live Presence Carets:** See other collaborators' colored carets, name tags, and active text selections moving smoothly in real-time.
- **Dedicated Sync Gateway:** High-throughput WebSocket server running on port `:8080`, supporting horizontal clustering over Redis.
- **Debounced Snapshots:** Automatically flushes compressed binary checkpoints to SQLite/PostgreSQL and S3/R2 storage every 500ms.

### 👤 4. User Accounts & Workspaces
- **Self-Hosted Authentication:** Built-in **Better-Auth** with Email/Password, Magic Link, and Google OAuth.
- **Workspaces:** Organize documents across personal and team workspaces.
- **Revision History:** Browse past document checkpoints, view author attributions, and restore previous states with one click.

---

## 🏛️ The 4 Non-Negotiable Core Engine Pillars

| Pillar | Engineering Solution | Why It Matters |
| :--- | :--- | :--- |
| **1. The "Hidden DOM" Proxy** | Floating 1px × 1px `<textarea>` (`HiddenInput.vue`) | Captures keyboard events, clipboard shortcuts, and complex IME compositions (Chinese, Japanese, Korean, Vietnamese, emojis) while maintaining WCAG/ARIA screen reader accessibility. |
| **2. 3-Tier Layered Canvas** | Decoupled Background, Document Surface, and Overlay layers | Decouples static paper margins and Skia text rendering from high-frequency caret blinking (60/120 FPS), eliminating redundant repaints. |
| **3. Spatial Hit-Testing** | 2D R-Tree index (`rbush` / `rstar`) | Maps mouse clicks `(x, y)` to logical text characters in microseconds ($O(\log N)$) without scanning the entire document. |
| **4. Asynchronous Web Worker Layout** | Background layout calculations via `SharedArrayBuffer` | Offloads heavy paragraph wrapping and pagination to a worker thread so live typing never drops a frame. |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   NUXT 3 FULL-STACK APPLICATION                        │
│       • Full-Stack Nitro: Better-Auth + Drizzle ORM (Postgres/SQLite)  │
│       • Template Gallery & Document Dashboard                          │
│       • Google Docs Share Modal (Public/Private Links)                 │
│       • Hidden Input Proxy (<textarea>): Intercepts IME & a11y         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Keystrokes & Pointer Events
┌───────────────────────────────────▼────────────────────────────────────┐
│                  HIGH-PERFORMANCE CORE (Rust / Wasm)                   │
│                                                                        │
│  State & CRDT Model:        Loro (Rust CRDT rope with rich-text spans) │
│  Text Shaping & Fallback:   cosmic-text / rustybuzz (HarfBuzz)         │
│  Line-Breaking Engine:      Unicode UAX #14 + Knuth-Plass algorithm    │
│  2D Box Layout & Flow:      taffy (Flexbox/Grid/Table geometries)      │
│  Spatial Hit-Testing:       2D R-Tree (rbush / rstar, O(log N) clicks) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Glyph IDs & Paint Coordinates
┌───────────────────────────────────▼────────────────────────────────────┐
│                3-TIER HARDWARE-ACCELERATED CANVAS                      │
│                                                                        │
│  Layer 1 (Bottom): Page margins, background, drop-shadows (Cached)     │
│  Layer 2 (Middle): Document glyphs, images, tables (Skia WebGL)        │
│  Layer 3 (Top):    Caret blinking, selections, presence (60/120 FPS)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Domain | Technology | Role |
| :--- | :--- | :--- |
| **Engine Core** | **Rust** (Wasm via `wasm-pack`) | State management, text layout, shaping, and hit-testing |
| **State / CRDT** | **`loro`** (Rust) | Rich-text CRDT rope buffer with formatting spans |
| **Graphics Engine** | **`canvaskit-wasm`** (Google Skia) | Hardware-accelerated WebGL / WebGPU 2D rendering |
| **Text Shaping** | **`cosmic-text`** / **HarfBuzz** | OpenType font tables, ligatures, and bidirectional text |
| **Spatial Index** | **`rbush`** / **`rstar`** | 2D R-Tree spatial index for cursor hit-testing |
| **Frontend Shell** | **Nuxt 3** (Vue 3 + TypeScript) | Application shell, toolbars, dialogs, and Nitro server |
| **Database & ORM** | **Drizzle ORM** (PostgreSQL / SQLite) | Users, documents, permissions, templates, and revisions |
| **Authentication** | **Better-Auth** | Self-hosted sessions, OAuth, and workspace management |
| **Sync Gateway** | **`apps/sync`** (Node.js / ws + Redis) | Real-time WebSocket room multiplexing & awareness |
| **Styling** | **Tailwind CSS** | Clean, technical, high-density interface styling |

---

## Quick Start

### Prerequisites
- **Node.js** $\ge 20$
- **pnpm** $\ge 9$
- **Rust toolchain** (`rustup`, `cargo`, `wasm-pack`) — *for compiling the Rust Wasm engine*

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/your-org/office-engine.git
cd office-engine

# Install dependencies across all monorepo packages
pnpm install

# Start both the Nuxt 3 web app and the WebSocket sync server concurrently
pnpm dev:all
```

- **Web Application:** `http://localhost:3000`
- **Sync Gateway:** `ws://localhost:8080`

### Workspace Commands

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts the Nuxt 3 frontend application (`apps/web`) |
| `pnpm dev:sync` | Starts the WebSocket collaboration server (`apps/sync`) |
| `pnpm dev:all` | Runs both frontend and sync servers in parallel |
| `pnpm build:wasm` | Compiles `crates/engine` into WebAssembly |
| `pnpm build` | Builds the entire monorepo for production deployment |

---

## Repository Structure

```
office-engine/
├── AGENTS.md                  # Comprehensive agent rules, contracts, and finish gates
├── README.md                  # Project overview, feature breakdown, and quick start
├── ROADMAP.md                 # 5-phase engineering roadmap
├── pnpm-workspace.yaml        # Monorepo configuration
├── Cargo.toml                 # Rust workspace configuration
│
├── crates/                    # Rust Core Engine (Wasm)
│   └── engine/
│       ├── Cargo.toml         # loro, wasm-bindgen, taffy dependencies
│       └── src/               # Document, layout, and text shaping modules
│
├── apps/
│   ├── web/                   # Nuxt 3 Full-Stack Application
│   │   ├── components/        # CanvasSurface, HiddenInput, Toolbar, ShareModal
│   │   ├── pages/             # Dashboard, Template Gallery, and Canvas Editor
│   │   └── server/database/   # Drizzle ORM schema (Users, Docs, Shares, Templates)
│   │
│   └── sync/                  # Dedicated WebSocket Collaboration Server
│       └── src/index.ts       # Room multiplexing, presence, and permission gating
│
└── reference/                 # Open-Source References for Agent Lookup
    ├── canvas-editor/         # TypeScript canvas document editor reference (Hufe921)
    └── cosmic-text/           # Rust text shaping & font engine reference
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
