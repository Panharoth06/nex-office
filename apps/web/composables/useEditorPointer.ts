import { ref, type Ref } from 'vue'
import { hitTestChar, type LineBox } from '~/lib/editor/textLayout'

export interface EditorPointerOptions {
  lines: () => LineBox[]
  context: () => CanvasRenderingContext2D | null
  page: () => HTMLElement | null
  caretIndex: Ref<number>
  anchorIndex: Ref<number | null>
  margin: number
  ready: () => boolean
  focus: () => void
  syncPending: () => void
  redraw: () => void
}

/** Mouse selection and click-to-place handling for the canvas editor. */
export function useEditorPointer(options: EditorPointerOptions) {
  const isSelecting = ref(false)

  function handleMouseDown(event: MouseEvent) {
    event.preventDefault()
    options.focus()
    if (!options.ready()) return

    const index = indexAt(event)
    if (index === null) return

    options.anchorIndex.value = index
    options.caretIndex.value = index
    isSelecting.value = true
    options.syncPending()
    options.redraw()
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isSelecting.value || !options.ready()) return

    const index = indexAt(event)
    if (index === null) return

    options.caretIndex.value = index
    options.syncPending()
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

  return { handleMouseDown, handleMouseMove, stopSelecting }
}
