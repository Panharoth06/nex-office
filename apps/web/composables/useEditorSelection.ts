import { computed, ref, type Ref } from 'vue'
import { hitTestChar, type LineBox } from '~/lib/editor/textLayout'
import {
  EMPTY_FORMAT_STATE,
  formatStateAtCaret,
  formatStateForRange,
  type Alignment,
  type FormatKey,
  type FormatState,
  type ListType,
  type ParagraphStyle,
} from '~/lib/editor/richText'
import {
  applyBlockState,
  applyInlineFormat,
  blockFormatState,
  blocksForRange,
  changeListLevelRange,
  setAlignmentRange,
  toggleListRange,
} from '~/lib/editor/editorCommands'
import type { TextEngine } from '~/lib/editor/useEngine'
import { useEditorKeyboard } from '~/composables/useEditorKeyboard'
import { useEditorPointer } from '~/composables/useEditorPointer'
import { useEditorTyping } from '~/composables/useEditorTyping'

export interface EditorSelectionOptions {
  engine: () => TextEngine | null
  lines: () => LineBox[]
  context: () => CanvasRenderingContext2D | null
  page: () => HTMLElement | null
  caretIndex: Ref<number>
  caretX: () => number
  margin: number
  ready: () => boolean
  focus: () => void
  redraw: () => void
  updateCaret: () => void
  markTyped: () => void
  scheduleSave: () => void
  onFormatState: (state: FormatState) => void
}

/**
 * Selection, keyboard navigation, and editing commands for the canvas editor.
 * Pure range/mark work lives in `editorCommands.ts`; this composable owns the
 * reactive caret, pending typing style, pointer interaction, and redraw cycle.
 */
export function useEditorSelection(options: EditorSelectionOptions) {
  const anchorIndex = ref<number | null>(null)
  // Style applied to text typed at a collapsed caret, mirroring canvas-editor's
  // range.setDefaultStyle() behaviour.
  const pendingFormat = ref<FormatState | null>(null)

  const selectionStart = computed(() =>
    anchorIndex.value === null
      ? options.caretIndex.value
      : Math.min(anchorIndex.value, options.caretIndex.value),
  )
  const selectionEnd = computed(() =>
    anchorIndex.value === null
      ? options.caretIndex.value
      : Math.max(anchorIndex.value, options.caretIndex.value),
  )
  const hasSelection = computed(() => selectionStart.value !== selectionEnd.value)

  function styleAtCaret(): FormatState {
    const engine = options.engine()
    if (!engine) return { ...EMPTY_FORMAT_STATE }
    return formatStateAtCaret(engine.getDelta(), options.caretIndex.value)
  }

  function currentFormatState(): FormatState {
    if (hasSelection.value) {
      const engine = options.engine()
      if (!engine) return { ...EMPTY_FORMAT_STATE }
      return formatStateForRange(
        engine.getDelta(),
        selectionStart.value,
        selectionEnd.value,
      )
    }
    return pendingFormat.value ?? styleAtCaret()
  }

  function syncPendingToCaret() {
    pendingFormat.value = hasSelection.value ? null : styleAtCaret()
  }

  function deleteSelection(): boolean {
    const engine = options.engine()
    if (!engine || !hasSelection.value) return false

    const start = selectionStart.value
    engine.deleteRange(start, selectionEnd.value - start)
    options.caretIndex.value = start
    anchorIndex.value = null
    return true
  }

  function clampSelection(max: number) {
    options.caretIndex.value = Math.min(options.caretIndex.value, max)
    if (anchorIndex.value !== null) {
      anchorIndex.value = Math.min(anchorIndex.value, max)
    }
  }

  function toggleMark(key: FormatKey) {
    // Toolbar clicks move focus to the button; return it to the hidden input so
    // the user can keep typing immediately after formatting.
    options.focus()

    const engine = options.engine()
    if (!engine) return

    const state = currentFormatState()
    const next = { ...state, [key]: !state[key] }

    if (hasSelection.value) {
      const start = selectionStart.value
      applyInlineFormat(engine, start, selectionEnd.value, next)
      const startState = formatStateAtCaret(engine.getDelta(), start)
      pendingFormat.value = { ...startState, [key]: next[key] }
      options.redraw()
      options.scheduleSave()
      return
    }

    // Collapsed caret: remember the style for the next typed characters.
    pendingFormat.value = next
    options.onFormatState(next)
  }

  function moveCaret(next: number, extend: boolean) {
    if (extend && anchorIndex.value === null) {
      anchorIndex.value = options.caretIndex.value
    }
    if (!extend) anchorIndex.value = null

    options.caretIndex.value = Math.max(0, next)
    syncPendingToCaret()
    options.updateCaret()
    options.markTyped()
  }

  function moveVertical(direction: number, extend: boolean) {
    const context = options.context()
    const lines = options.lines()
    if (!context || lines.length === 0) return

    const current = lines.findIndex(
      (line) =>
        options.caretIndex.value >= line.start &&
        options.caretIndex.value <= line.end,
    )
    const targetIndex = Math.min(Math.max(current + direction, 0), lines.length - 1)
    if (targetIndex === current) return

    const target = lines[targetIndex]
    const next = hitTestChar(
      context,
      [target],
      options.caretX(),
      target.y + target.height / 2,
      options.margin,
    )

    if (extend && anchorIndex.value === null) {
      anchorIndex.value = options.caretIndex.value
    }
    if (!extend) anchorIndex.value = null

    options.caretIndex.value = next
    syncPendingToCaret()
    options.updateCaret()
    options.markTyped()
  }

  function setParagraphStyle(style: ParagraphStyle) {
    options.focus()

    const engine = options.engine()
    if (!engine) return

    const start = hasSelection.value ? selectionStart.value : options.caretIndex.value
    const end = hasSelection.value ? selectionEnd.value : start
    const inlineState = currentFormatState()

    for (const block of blocksForRange(engine.getDelta(), start, end)) {
      const current = blockFormatState(block)
      applyBlockState(engine, block, { ...current, paragraph: style })
    }

    pendingFormat.value = { ...inlineState, paragraph: style }
    options.redraw()
    options.scheduleSave()
  }

  function toggleList(type: ListType) {
    options.focus()

    const engine = options.engine()
    if (!engine) return

    const start = hasSelection.value ? selectionStart.value : options.caretIndex.value
    const end = hasSelection.value ? selectionEnd.value : start
    const inlineState = currentFormatState()
    const next = toggleListRange(engine, start, end, type)
    if (!next) return

    pendingFormat.value = {
      ...next,
      bold: inlineState.bold,
      italic: inlineState.italic,
      underline: inlineState.underline,
    }
    options.redraw()
    options.scheduleSave()
  }

  function setAlignment(align: Alignment) {
    options.focus()

    const engine = options.engine()
    if (!engine) return

    const start = hasSelection.value ? selectionStart.value : options.caretIndex.value
    const end = hasSelection.value ? selectionEnd.value : start
    const inlineState = currentFormatState()
    const next = setAlignmentRange(engine, start, end, align)
    if (!next) return

    pendingFormat.value = {
      ...next,
      bold: inlineState.bold,
      italic: inlineState.italic,
      underline: inlineState.underline,
    }
    options.redraw()
    options.scheduleSave()
  }

  function changeListLevel(delta: number): boolean {
    const engine = options.engine()
    if (!engine) return false

    const start = hasSelection.value ? selectionStart.value : options.caretIndex.value
    const end = hasSelection.value ? selectionEnd.value : start
    const inlineState = currentFormatState()
    const next = changeListLevelRange(engine, start, end, delta)
    if (!next) return false

    pendingFormat.value = {
      ...next,
      bold: inlineState.bold,
      italic: inlineState.italic,
      underline: inlineState.underline,
    }
    options.redraw()
    options.scheduleSave()
    return true
  }

  const { insertText, insertBreak } = useEditorTyping({
    engine: options.engine,
    caretIndex: options.caretIndex,
    anchorIndex,
    hasSelection: () => hasSelection.value,
    selectionStart: () => selectionStart.value,
    selectionEnd: () => selectionEnd.value,
    pendingFormat,
    currentFormatState,
    styleAtCaret,
    deleteSelection,
    redraw: options.redraw,
    scheduleSave: options.scheduleSave,
  })

  const { handleMouseDown, handleMouseMove, stopSelecting } = useEditorPointer({
    lines: options.lines,
    context: options.context,
    page: options.page,
    caretIndex: options.caretIndex,
    anchorIndex,
    margin: options.margin,
    ready: options.ready,
    focus: options.focus,
    syncPending: syncPendingToCaret,
    redraw: options.redraw,
  })

  const { onKeydown } = useEditorKeyboard({
    engine: options.engine,
    caretIndex: options.caretIndex,
    lines: options.lines,
    hasSelection: () => hasSelection.value,
    moveCaret,
    moveVertical,
    deleteSelection,
    insertBreak,
    insertText,
    changeListLevel,
    syncPending: syncPendingToCaret,
    redraw: options.redraw,
    scheduleSave: options.scheduleSave,
  })

  return {
    selectionStart,
    selectionEnd,
    hasSelection,
    currentFormatState,
    setParagraphStyle,
    toggleList,
    setAlignment,
    insertText,
    deleteSelection,
    clampSelection,
    toggleMark,
    onKeydown,
    handleMouseDown,
    handleMouseMove,
    stopSelecting,
  }
}
