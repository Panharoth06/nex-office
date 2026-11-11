import { computed, ref, type Ref } from 'vue'
import { hitTestChar, lineForIndex, type LineBox } from '~/lib/editor/textLayout'
import {
  EMPTY_FORMAT_STATE,
  formatStateForRange,
  type FormatKey,
  type FormatState,
  type ParagraphStyle,
} from '~/lib/editor/richText'
import type { TextEngine } from '~/lib/editor/useEngine'

export interface EditorSelectionOptions {
  engine: () => TextEngine | null
  lines: () => LineBox[]
  context: () => CanvasRenderingContext2D | null
  page: () => HTMLElement | null
  caretIndex: Ref<number>
  caretX: () => number
  margin: number
  lineHeight: number
  ready: () => boolean
  focus: () => void
  redraw: () => void
  updateCaret: () => void
  markTyped: () => void
  scheduleSave: () => void
  onFormatState: (state: FormatState) => void
}

const FORMAT_KEYS: FormatKey[] = ['bold', 'italic', 'underline']

/**
 * Selection, keyboard navigation, formatting, and pointer selection for the
 * canvas editor. Keeping this out of `CanvasSurface.vue` preserves the
 * component's size budget and makes the editing rules unit-testable.
 */
export function useEditorSelection(options: EditorSelectionOptions) {
  const anchorIndex = ref<number | null>(null)
  const isSelecting = ref(false)
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
    return formatStateForRange(
      engine.getDelta(),
      options.caretIndex.value,
      options.caretIndex.value,
    )
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

  function applyFormat(
    engine: TextEngine,
    start: number,
    end: number,
    state: FormatState,
  ) {
    if (start >= end) return
    for (const key of FORMAT_KEYS) {
      engine.setMark(start, end, key, state[key])
    }
    if (state.paragraph === 'normal') {
      engine.clearMark(start, end, 'paragraph')
    } else {
      engine.setMarkValue(start, end, 'paragraph', state.paragraph)
    }
  }

  function paragraphRanges(
    text: string,
    start: number,
    end: number,
  ): Array<{ start: number; end: number }> {
    const chars = Array.from(text)
    const ranges: Array<{ start: number; end: number }> = []
    let lineStart = 0

    for (let index = 0; index <= chars.length; index += 1) {
      if (index !== chars.length && chars[index] !== '\n') continue

      const lineEnd = index
      const intersects =
        end > start
          ? lineStart < end && lineEnd > start
          : start >= lineStart && start <= lineEnd

      if (intersects && lineEnd > lineStart) {
        ranges.push({ start: lineStart, end: lineEnd })
      }
      lineStart = index + 1
    }

    return ranges
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
      const end = selectionEnd.value
      applyFormat(engine, start, end, next)
      pendingFormat.value = next
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
    const ranges = paragraphRanges(engine.getText(), start, end)

    for (const range of ranges) {
      if (style === 'normal') {
        engine.clearMark(range.start, range.end, 'paragraph')
      } else {
        engine.setMarkValue(range.start, range.end, 'paragraph', style)
      }
    }

    pendingFormat.value = { ...currentFormatState(), paragraph: style }
    options.redraw()
    options.scheduleSave()
  }

  function insertText(text: string) {
    const engine = options.engine()
    if (!engine || !text) return

    const format = currentFormatState()
    const start = hasSelection.value ? selectionStart.value : options.caretIndex.value
    if (hasSelection.value) {
      engine.deleteRange(start, selectionEnd.value - start)
      anchorIndex.value = null
    }

    engine.insertText(start, text)
    const end = start + Array.from(text).length
    applyFormat(engine, start, end, format)
    options.caretIndex.value = end
    pendingFormat.value = format

    options.redraw()
    options.scheduleSave()
  }

  function onKeydown(event: KeyboardEvent) {
    const engine = options.engine()
    if (event.isComposing || !engine) return

    const max = Array.from(engine.getText()).length

    switch (event.key) {
      case 'Backspace':
        event.preventDefault()
        if (hasSelection.value) {
          deleteSelection()
          options.redraw()
          options.scheduleSave()
        } else if (options.caretIndex.value > 0) {
          engine.deleteRange(options.caretIndex.value - 1, 1)
          options.caretIndex.value -= 1
          options.redraw()
          options.scheduleSave()
        }
        break
      case 'Delete':
        event.preventDefault()
        if (hasSelection.value) {
          deleteSelection()
          options.redraw()
          options.scheduleSave()
        } else if (options.caretIndex.value < max) {
          engine.deleteRange(options.caretIndex.value, 1)
          options.redraw()
          options.scheduleSave()
        }
        break
      case 'ArrowLeft':
        event.preventDefault()
        moveCaret(Math.max(0, options.caretIndex.value - 1), event.shiftKey)
        break
      case 'ArrowRight':
        event.preventDefault()
        moveCaret(Math.min(max, options.caretIndex.value + 1), event.shiftKey)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveVertical(-1, event.shiftKey)
        break
      case 'ArrowDown':
        event.preventDefault()
        moveVertical(1, event.shiftKey)
        break
      case 'Home':
        event.preventDefault()
        moveCaret(
          lineForIndex(options.lines(), options.caretIndex.value).start,
          event.shiftKey,
        )
        break
      case 'End':
        event.preventDefault()
        moveCaret(
          lineForIndex(options.lines(), options.caretIndex.value).end,
          event.shiftKey,
        )
        break
      case 'Tab':
        event.preventDefault()
        insertText('  ')
        break
    }
  }

  function handleMouseDown(event: MouseEvent) {
    event.preventDefault()
    options.focus()
    if (!options.ready()) return

    const index = indexAt(event)
    if (index === null) return

    anchorIndex.value = index
    options.caretIndex.value = index
    isSelecting.value = true
    syncPendingToCaret()
    options.redraw()
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isSelecting.value || !options.ready()) return

    const index = indexAt(event)
    if (index === null) return

    options.caretIndex.value = index
    syncPendingToCaret()
    options.redraw()
  }

  function stopSelecting() {
    isSelecting.value = false
  }

  function indexAt(event: MouseEvent): number | null {
    const context = options.context()
    const page = options.page()
    const lines = options.lines()
    if (!context || !page || lines.length === 0) return null

    const rect = page.getBoundingClientRect()
    return hitTestChar(
      context,
      lines,
      event.clientX - rect.left,
      event.clientY - rect.top,
      options.margin,
    )
  }

  return {
    selectionStart,
    selectionEnd,
    hasSelection,
    currentFormatState,
    setParagraphStyle,
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
