import type { FormatKey, TextDeltaSegment } from './richText'

export interface TextEngine {
  insertText(pos: number, text: string): void
  deleteRange(pos: number, len: number): void
  getText(): string
  setMark(start: number, end: number, key: FormatKey, enabled: boolean): void
  getDelta(): TextDeltaSegment[]
  exportSnapshot(): Uint8Array
  importSnapshot(bytes: Uint8Array): void
}

interface WasmEngineCore {
  insert_text(pos: number, text: string): void
  delete_range(pos: number, len: number): void
  get_text(): string
  set_mark(start: number, end: number, key: string, enabled: boolean): void
  get_delta(): string
  export_snapshot(): Uint8Array
  import_snapshot(bytes: Uint8Array): void
}

interface WasmModule {
  default: () => Promise<unknown>
  EngineCore: new () => WasmEngineCore
}

/**
 * Load the Rust Wasm engine from `public/wasm`.
 *
 * The generated module is served as a static asset, so Vite must not try to
 * bundle it. `@vite-ignore` keeps the import at runtime.
 */
export async function loadEngine(): Promise<TextEngine> {
  const base = import.meta.env.BASE_URL || '/'
  const normalized =
    base === './' || base === ''
      ? '/'
      : base.endsWith('/')
        ? base
        : `${base}/`
  const url = `${normalized}wasm/office_engine_core.js`

  // Vite must leave this as a runtime import from public/wasm.
  const module = (await import(/* @vite-ignore */ url)) as WasmModule

  await module.default()
  const core = new module.EngineCore()

  return {
    insertText: (pos, text) => core.insert_text(pos, text),
    deleteRange: (pos, len) => core.delete_range(pos, len),
    getText: () => core.get_text(),
    setMark: (start, end, key, enabled) => core.set_mark(start, end, key, enabled),
    getDelta: () => {
      try {
        return JSON.parse(core.get_delta()) as TextDeltaSegment[]
      } catch {
        return []
      }
    },
    exportSnapshot: () => core.export_snapshot(),
    importSnapshot: (bytes) => core.import_snapshot(bytes),
  }
}
