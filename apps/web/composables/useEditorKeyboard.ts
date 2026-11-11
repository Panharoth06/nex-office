import type { Ref } from 'vue'
import { blockForCaret } from '~/lib/editor/editorCommands'
import { lineForIndex, type LineBox } from '~/lib/editor/textLayout'
import type { TextEngine } from '~/lib/editor/useEngine'

export interface EditorKeyboardOptions {
  engine: () => TextEngine | null
  caretIndex: Ref<number>
  lines: () => LineBox[]
  hasSelection: () => boolean
  moveCaret: (next: number, extend: boolean) => void
  moveVertical: (direction: number, extend: boolean) => void
  deleteSelection: () => boolean
  insertBreak: () => void
  insertText: (text: string) => void
  changeListLevel: (delta: number) => boolean
  undo: () => boolean
  redo: () => boolean
  syncPending: () => void
  redraw: () => void
  scheduleSave: () => void
}

/** Keyboard navigation and editing commands for the canvas editor. */
export function useEditorKeyboard(options: EditorKeyboardOptions) {
  function onKeydown(event: KeyboardEvent) {
    const engine = options.engine()
    if (event.isComposing || !engine) return

    const modifier = event.metaKey || event.ctrlKey
    if (modifier && !event.altKey) {
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) options.redo()
        else options.undo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        options.redo()
        return
      }
    }

    const max = Array.from(engine.getText()).length

    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        options.insertBreak()
        break
      case 'Backspace':
        event.preventDefault()
        if (options.hasSelection()) {
          options.deleteSelection()
          options.syncPending()
          options.redraw()
          options.scheduleSave()
          break
        }
        if (options.caretIndex.value > 0) {
          const block = blockForCaret(engine.getDelta(), options.caretIndex.value)
          if (
            options.caretIndex.value === block.start &&
            block.style.list
          ) {
            options.changeListLevel(-1)
            break
          }
          engine.deleteRange(options.caretIndex.value - 1, 1)
          options.caretIndex.value -= 1
          options.syncPending()
          options.redraw()
          options.scheduleSave()
        } else {
          const block = blockForCaret(engine.getDelta(), 0)
          if (block.style.list) options.changeListLevel(-1)
        }
        break
      case 'Delete':
        event.preventDefault()
        if (options.hasSelection()) {
          options.deleteSelection()
          options.syncPending()
          options.redraw()
          options.scheduleSave()
        } else if (options.caretIndex.value < max) {
          engine.deleteRange(options.caretIndex.value, 1)
          options.syncPending()
          options.redraw()
          options.scheduleSave()
        }
        break
      case 'ArrowLeft':
        event.preventDefault()
        options.moveCaret(Math.max(0, options.caretIndex.value - 1), event.shiftKey)
        break
      case 'ArrowRight':
        event.preventDefault()
        options.moveCaret(Math.min(max, options.caretIndex.value + 1), event.shiftKey)
        break
      case 'ArrowUp':
        event.preventDefault()
        options.moveVertical(-1, event.shiftKey)
        break
      case 'ArrowDown':
        event.preventDefault()
        options.moveVertical(1, event.shiftKey)
        break
      case 'Home':
        event.preventDefault()
        options.moveCaret(
          lineForIndex(options.lines(), options.caretIndex.value).start,
          event.shiftKey,
        )
        break
      case 'End':
        event.preventDefault()
        options.moveCaret(
          lineForIndex(options.lines(), options.caretIndex.value).end,
          event.shiftKey,
        )
        break
      case 'Tab':
        event.preventDefault()
        if (options.changeListLevel(event.shiftKey ? -1 : 1)) break
        if (!event.shiftKey) options.insertText('  ')
        break
    }
  }

  return { onKeydown }
}
