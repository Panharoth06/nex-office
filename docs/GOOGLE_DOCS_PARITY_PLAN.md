# Google Docs Parity Plan — Reference-Driven

> Scope: make `kind = doc` a genuinely usable Google Docs-style editor before
> expanding Sheets, Slides, and Draw. Reference projects accelerate this, but
> license compatibility decides whether we copy, link, or only study code.

---

## 1. License guardrails

| Project | License | How we use it |
| :--- | :--- | :--- |
| ONLYOFFICE `sdkjs` / `core` | **AGPL-3.0** | Behavioural reference only. Never copy or link into this MIT repo. |
| Univer | Apache-2.0 | Reference; optional dependency with NOTICE attribution. |
| canvas-editor (`reference/canvas-editor`) | **MIT** | Primary code-level reference; patterns may be ported with attribution. |
| cosmic-text (`reference/cosmic-text`) | MIT / Apache-2.0 | Dependency or reference. |
| Parley | Apache-2.0 / MIT | Rust text-layout dependency candidate. |
| ProseMirror / Lexical / Tiptap | MIT | Reference for schema, commands, selection, undo. |
| BlockSuite | MPL-2.0 | Reference only; do not copy files into MIT sources. |
| Loro | MIT | Existing CRDT dependency. |
| `docx-rs` | MIT | DOCX writer dependency. |
| Typst | Apache-2.0 | PDF export dependency/reference. |
| pdf.js | Apache-2.0 | PDF viewer later. |

OnlyOffice is the closest product to Word/Docs, but `sdkjs` is AGPL-3.0.
Reading it for algorithms is fine; copying or close-translating code into this
repository is not. Implement our own code and tests after studying it.

---

## 2. Reference map

### Pagination, layout, page furniture
- **OnlyOffice**: `sdkjs/word/Editor/Document.js` (`Document_Recalculate_Page`),
  `sdkjs/word/Editor/DocumentContent.js` (`Recalculate`, `TransformPoint`),
  `sdkjs/word/Drawing/DrawingDocument.js`.
- **canvas-editor**: `src/editor/core/layout/LayoutEngine.ts`,
  `PageLayout.ts`, `TextMeasurer.ts`,
  `src/editor/core/draw/frame/Header.ts`, `Footer.ts`, `PageNumber.ts`.

### Caret, selection, hit-testing
- **canvas-editor**: `src/editor/core/position/Position.ts`,
  `src/editor/core/range/Range.ts`.
- **OnlyOffice**: `sdkjs/common/Drawings/Hit.js`.

### Rich text, formatting, undo
- **canvas-editor**: `src/editor/core/draw/richtext/*`,
  `src/editor/core/history/*`, `src/editor/core/worker/*`.
- **OnlyOffice**: `sdkjs/common/HistoryCommon.js`.
- **Univer**: `packages/docs`, `docs-ui`, `docs-drawing`, `docs-find-replace`,
  `docs-toc`, `docs-thread-comment`, `docs-hyper-link`.

### IME and keyboard
- **canvas-editor**: `src/editor/core/listener/Composition.ts`, `Keydown.ts`,
  `Input.ts`.

### Collaboration
- **Loro** sync/version-vector/undo APIs.
- **OnlyOffice** `sdkjs/common/CollaborativeEditingBase.js` for behaviour only.

### Comments, reviews, history
- **OnlyOffice**: `sdkjs/word/Editor/Comments.js`, `CommentsChanges.js`,
  `DocumentChanges.js`, `Footnotes.js`.
- **Univer**: `docs-thread-comment`, `docs-toc`.

### DOCX / PDF
- `docx-rs` for DOCX output.
- **OnlyOffice** `core/OOXML/DocxFormat` for structural reference.
- **Typst** / `typst.ts` for vector PDF; **pdf.js** for viewing.

---

## 3. Dependencies to reuse instead of building

1. **Parley** — Rust text layout (line breaking, inline boxes, selection).
2. **Taffy** — block/flex layout (already a dependency).
3. **Loro** — CRDT, undo manager, snapshots, version vectors.
4. **CanvasKit** — Skia renderer.
5. **`docx-rs`** — DOCX export.
6. **Typst** — PDF export.
7. **`rbush`** — spatial hit-testing (already a dependency).
8. **`argon2`** — share-link passwords.

---

## 4. Delivery phases

### Phase 0 — Document spine
- API: create/list/get/rename/archive documents, load/save snapshots.
- Storage: document updates, snapshot persistence, dev user bootstrap.
- Web: real dashboard, create/open, title save, snapshot load/autosave,
  sign-in page and dev login.
- Gate: create a document, type, reload, and the text persists.

### Phase 1 — Docs engine
- [x] Rich-text marks (bold/italic/underline), selection, and toolbar wiring
      (first slice).
- [x] Multi-page A4 pagination and page numbers.
- [x] Paragraph styles (Normal / H1–H3) stored as CRDT marks with variable
      line heights.
- [x] Bullet and numbered lists with nested levels, list-aware Enter/Tab/
      Backspace behavior, and left/center/right paragraph alignment.
- [ ] Paragraph spacing, indentation outside lists, justified alignment, and
      further block commands.
- [ ] Headers and footers.
- [ ] Paint-command IR + CanvasKit renderer.
- [ ] R-tree hit-testing for large documents.
- [ ] Links, images, basic tables.
- [ ] Gate: formatted multi-page document edits at 60 FPS.

Block attributes (`paragraph`, `list`, `list_level`, `align`) are stored as
Loro text marks on the paragraph text and on the newline before the paragraph.
The leading newline describes the paragraph that follows it, which lets empty
list items and trailing paragraphs survive reloads. This remains an interim
mark-based block model until headers/footers force a shared document-zone
refactor.

### Phase 2 — Collaboration
- Loro relay, Redis pub/sub, presence, snapshot flush, reconnect.
- Gate: two replicas, no lost updates, pod-kill durability.

### Phase 3 — Sharing, comments, history
- Permissions, public links, comments, TOC, find/replace, revisions.
- Gate: public viewer link is read-only in incognito.

### Phase 4 — DOCX / PDF
- DOCX import/export, vector PDF export, PDF viewer.
- Gate: round-trip fixtures and 100-page export.

---

## 5. Reference workspace

Do not commit large AGPL clones. Use a sparse checkout and keep it out of
Docker images (`reference/` is already in `.dockerignore`):

```sh
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/ONLYOFFICE/sdkjs.git reference/onlyoffice-sdkjs
cd reference/onlyoffice-sdkjs
git sparse-checkout set word/Editor word/Drawing common/Drawings common/HistoryCommon.js
```

Record the commit, license, and subsystem in `reference/README.md`.

---

## 6. Phase 0 implementation checklist

- [x] `crates/storage`: `is_archived`, update/archive, dev user lookup.
- [x] `crates/api`: `/api/documents` CRUD, `/api/documents/{id}/snapshot`.
- [x] `crates/api`: dev-only login behind `DEV_AUTH`.
- [x] `apps/web`: API client, auth-aware dashboard, login page.
- [x] `apps/web`: editor loads snapshot and autosaves.
- [ ] Tests: API/storage integration where a database is available; Playwright
      create/type/reload once browser tests are reintroduced. (Verified manually
      with headless Chrome during Phase 0.)

## 7. Non-goals for Phase 0

Tables, images, comments, sharing, multi-user presence, DOCX, PDF, offline.
Those land in Phases 1–4.
