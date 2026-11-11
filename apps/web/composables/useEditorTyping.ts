import type { Ref } from 'vue'
import { applyFullFormat, insertParagraphAt } from '~/lib/editor/editorCommands'
import { formatStateAtCaret, type FormatState } from '~/lib/editor/richText'
import type { TextEngine } from '~/lib/editor/useEngine'

export interface EditorTypingOptions {
  engine: () => TextEngine | null
  caretIndex: Ref<number>
  anchorIndex: Ref<number | null>
  hasSelection: () => boolean
  selectionStart: () => number
  selectionEnd: () => number
  pendingFormat: Ref<FormatState | null>
  currentFormatState: () => FormatState
  styleAtCaret: () => FormatState
  deleteSelection: () => boolean
  redraw: () => void
  scheduleSave: () => void
}

/** Text insertion, replacement, and paragraph-break handling. */
export function useEditorTyping(options: EditorTypingOptions) {
  function insertText(text: string) {
    const engine = options.engine()
    if (!engine || !text) return

    const start = options.hasSelection()
      ? options.selectionStart()
      : options.caretIndex.value
    const format = options.hasSelection()
      ? formatStateAtCaret(engine.getDelta(), start)
      : (options.pendingFormat.value ?? options.styleAtCaret())

    if (options.hasSelection()) {
      engine.deleteRange(start, options.selectionEnd() - start)
      options.anchorIndex.value = null
    }

    engine.insertText(start, text)
    const end = start + Array.from(text).length
    applyFullFormat(engine, start, end, format)
    options.caretIndex.value = end
    options.pendingFormat.value = format

    options.redraw()
    options.scheduleSave()
  }

  function insertBreak() {
    if (options.hasSelection()) {
      options.deleteSelection()
      options.pendingFormat.value = options.styleAtCaret()
    }

    const engine = options.engine()
    if (!engine) return

    engine.checkpoint()
    const result = insertParagraphAt(
      engine,
      options.caretIndex.value,
      options.currentFormatState(),
    )
    options.caretIndex.value = result.caret
    options.pendingFormat.value = result.format
    options.redraw()
    options.scheduleSave()
  }

  return { insertText, insertBreak }
}
