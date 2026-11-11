import type { FormatKey, TextDeltaSegment } from './richText'
import type { EditorZone } from './zones'

export interface TextEngine {
  insertText(pos: number, text: string, zone?: EditorZone): void
  deleteRange(pos: number, len: number, zone?: EditorZone): void
  getText(zone?: EditorZone): string
  setMark(
    start: number,
    end: number,
    key: FormatKey,
    enabled: boolean,
    zone?: EditorZone,
  ): void
  clearMark(start: number, end: number, key: string, zone?: EditorZone): void
  setMarkValue(
    start: number,
    end: number,
    key: string,
    value: string,
    zone?: EditorZone,
  ): void
  getDelta(zone?: EditorZone): TextDeltaSegment[]
  undo(): boolean
  redo(): boolean
  canUndo(): boolean
  canRedo(): boolean
  checkpoint(): void
  exportSnapshot(): Uint8Array
  importSnapshot(bytes: Uint8Array): void
}

interface WasmEngineCore {
  insert_text_in_zone(pos: number, text: string, zone: string): void
  delete_range_in_zone(pos: number, len: number, zone: string): void
  get_text_in_zone(zone: string): string
  set_mark_in_zone(
    start: number,
    end: number,
    key: string,
    enabled: boolean,
    zone: string,
  ): void
  set_mark_value_in_zone(
    start: number,
    end: number,
    key: string,
    value: string,
    zone: string,
  ): void
  get_delta_in_zone(zone: string): string
  undo(): boolean
  redo(): boolean
  can_undo(): boolean
  can_redo(): boolean
  record_checkpoint(): void
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
    insertText: (pos, text, zone = 'body') =>
      core.insert_text_in_zone(pos, text, zone),
    deleteRange: (pos, len, zone = 'body') =>
      core.delete_range_in_zone(pos, len, zone),
    getText: (zone = 'body') => core.get_text_in_zone(zone),
    setMark: (start, end, key, enabled, zone = 'body') =>
      core.set_mark_in_zone(start, end, key, enabled, zone),
    clearMark: (start, end, key, zone = 'body') =>
      core.set_mark_in_zone(start, end, key, false, zone),
    setMarkValue: (start, end, key, value, zone = 'body') =>
      core.set_mark_value_in_zone(start, end, key, value, zone),
    getDelta: (zone = 'body') => {
      try {
        return JSON.parse(core.get_delta_in_zone(zone)) as TextDeltaSegment[]
      } catch {
        return []
      }
    },
    undo: () => core.undo(),
    redo: () => core.redo(),
    canUndo: () => core.can_undo(),
    canRedo: () => core.can_redo(),
    checkpoint: () => core.record_checkpoint(),
    exportSnapshot: () => core.export_snapshot(),
    importSnapshot: (bytes) => core.import_snapshot(bytes),
  }
}

/** Bind every text operation to one document zone. */
export function engineForZone(
  engine: TextEngine,
  zone: EditorZone,
  onEdit?: () => void,
): TextEngine {
  return {
    insertText: (pos, text) => {
      engine.insertText(pos, text, zone)
      onEdit?.()
    },
    deleteRange: (pos, len) => {
      engine.deleteRange(pos, len, zone)
      onEdit?.()
    },
    getText: () => engine.getText(zone),
    setMark: (start, end, key, enabled) => {
      engine.setMark(start, end, key, enabled, zone)
      onEdit?.()
    },
    clearMark: (start, end, key) => {
      engine.clearMark(start, end, key, zone)
      onEdit?.()
    },
    setMarkValue: (start, end, key, value) => {
      engine.setMarkValue(start, end, key, value, zone)
      onEdit?.()
    },
    getDelta: () => engine.getDelta(zone),
    undo: () => engine.undo(),
    redo: () => engine.redo(),
    canUndo: () => engine.canUndo(),
    canRedo: () => engine.canRedo(),
    checkpoint: () => engine.checkpoint(),
    exportSnapshot: () => engine.exportSnapshot(),
    importSnapshot: (bytes) => engine.importSnapshot(bytes),
  }
}
