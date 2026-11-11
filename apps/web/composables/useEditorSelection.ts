import { computed, ref, type Ref } from 'vue'
import { hitTestChar, lineForIndex, type LineBox } from '~/lib/editor/textLayout'
import { formatStateForRange, type FormatKey } from '~/lib/editor/richText'
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
  insertText: (text: string) => void
}

/**
 * Selection, keyboard navigation, formatting, and pointer selection for the
 * canvas editor. Keeping this out of `CanvasSurface.vue` preserves the
 * component's size budget and makes the editing rules unit-testable.
 */
export function useEditorSelection(options: EditorSelectionOptions) {
  const anchorIndex = ref<number | null>(null)
  const isSelecting = ref(false)

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
    if (!engine || !hasSelection.value) return

    const start = selectionStart.value
    const end = selectionEnd.value
    const state = formatStateForRange(engine.getDelta(), start, end)
    engine.setMark(start, end, key, !state[key])
    options.redraw()
    options.scheduleSave()
  }

  function moveCaret(next: number, extend: boolean) {
    if (extend && anchorIndex.value === null) {
      anchorIndex.value = options.caretIndex.value
    }
    if (!extend) anchorIndex.value = null

    options.caretIndex.value = Math.max(0, next)
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
      target.y + options.lineHeight / 2,
      options.margin,
      options.lineHeight,
    )

    if (extend && anchorIndex.value === null) {
      anchorIndex.value = options.caretIndex.value
    }
    if (!extend) anchorIndex.value = null

    options.caretIndex.value = next
    options.updateCaret()
    options.markTyped()
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
        options.insertText('  ')
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
    options.redraw()
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isSelecting.value || !options.ready()) return

    const index = indexAt(event)
    if (index === null) return

    options.caretIndex.value = index
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
      options.lineHeight,
    )
  }

  return {
    selectionStart,
    selectionEnd,
    hasSelection,
    deleteSelection,
    clampSelection,
    toggleMark,
    onKeydown,
    handleMouseDown,
    handleMouseMove,
    stopSelecting,
  }
}
