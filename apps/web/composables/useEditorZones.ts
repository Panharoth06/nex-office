import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type {
  Alignment,
  FormatKey,
  FormatState,
  ListType,
  ParagraphStyle,
} from '~/lib/editor/richText'
import type { LineBox, StyledChar } from '~/lib/editor/textLayout'
import { charsFromDelta } from '~/lib/editor/clipboard'
import { engineForZone, type TextEngine } from '~/lib/editor/useEngine'
import { insertStyledChars } from '~/lib/editor/editorCommands'
import type { EditorZone } from '~/lib/editor/zones'
import { useEditorSelection } from '~/composables/useEditorSelection'

export interface EditorZonesOptions {
  engine: () => TextEngine | null
  lines: (zone: EditorZone, page: number) => LineBox[]
  page: () => HTMLElement | null
  context: () => CanvasRenderingContext2D | null
  caretX: () => number
  margin: number
  ready: () => boolean
  focus: () => void
  redraw: () => void
  updateCaret: () => void
  markTyped: () => void
  scheduleSave: () => void
  onFormatState: (state: FormatState) => void
  onZoneChange: () => void
}

interface ZoneSelection {
  selectionStart: ComputedRef<number>
  selectionEnd: ComputedRef<number>
  currentFormatState: () => FormatState
  setParagraphStyle: (style: ParagraphStyle) => void
  toggleList: (type: ListType) => void
  setAlignment: (align: Alignment) => void
  insertText: (text: string) => void
  deleteSelection: () => boolean
  clampSelection: (max: number) => void
  syncPendingToCaret: () => void
  toggleMark: (key: FormatKey) => void
  onKeydown: (event: KeyboardEvent) => void
  handleMouseDown: (event: MouseEvent) => void
  handleMouseMove: (event: MouseEvent) => void
  stopSelecting: () => void
}

const ZONES: EditorZone[] = ['body', 'header', 'footer']

/**
 * Owns independent selections for the body, header, and footer while sharing
 * one hidden input, one caret overlay, and one snapshot stream.
 */
export function useEditorZones(options: EditorZonesOptions) {
  const activeZone = ref<EditorZone>('body')
  const activePage = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)
  let pendingLocalEdit = false
  let checkpointTimer: ReturnType<typeof setTimeout> | undefined
  const carets: Record<EditorZone, Ref<number>> = {
    body: ref(0),
    header: ref(0),
    footer: ref(0),
  }

  function markEdited() {
    pendingLocalEdit = true
    canUndo.value = true
    canRedo.value = false
    if (checkpointTimer !== undefined) clearTimeout(checkpointTimer)
    checkpointTimer = setTimeout(() => {
      checkpointTimer = undefined
      options.engine()?.checkpoint()
      pendingLocalEdit = false
      refreshHistory()
    }, 700)
  }

  function zonedEngine(zone: EditorZone): TextEngine | null {
    const base = options.engine()
    return base ? engineForZone(base, zone, markEdited) : null
  }

  function createSelection(zone: EditorZone): ZoneSelection {
    return useEditorSelection({
      engine: () => zonedEngine(zone),
      lines: () => options.lines(zone, activePage.value),
      context: options.context,
      page: options.page,
      caretIndex: carets[zone],
      caretX: options.caretX,
      margin: options.margin,
      ready: options.ready,
      focus: options.focus,
      redraw: options.redraw,
      updateCaret: options.updateCaret,
      markTyped: options.markTyped,
      scheduleSave: options.scheduleSave,
      undo,
      redo,
      onFormatState: options.onFormatState,
    })
  }

  const selections: Record<EditorZone, ZoneSelection> = {
    body: createSelection('body'),
    header: createSelection('header'),
    footer: createSelection('footer'),
  }

  const activeSelection = computed(() => selections[activeZone.value])
  const selectionStart = computed(() => activeSelection.value.selectionStart.value)
  const selectionEnd = computed(() => activeSelection.value.selectionEnd.value)
  const caretIndex = computed(() => carets[activeZone.value].value)

  function currentFormatState(): FormatState {
    return activeSelection.value.currentFormatState()
  }

  function refreshHistory() {
    const engine = options.engine()
    canUndo.value = pendingLocalEdit || (engine?.canUndo() ?? false)
    canRedo.value = !pendingLocalEdit && (engine?.canRedo() ?? false)
  }

  function syncSelections() {
    selections.body.syncPendingToCaret()
    selections.header.syncPendingToCaret()
    selections.footer.syncPendingToCaret()
  }

  function applyHistory(direction: 'undo' | 'redo'): boolean {
    const engine = options.engine()
    if (!engine) return false

    if (checkpointTimer !== undefined) {
      clearTimeout(checkpointTimer)
      checkpointTimer = undefined
    }
    if (direction === 'redo' && pendingLocalEdit) {
      engine.checkpoint()
      pendingLocalEdit = false
      refreshHistory()
      return false
    }
    pendingLocalEdit = false
    options.focus()
    const lengthsBefore = ZONES.map((zone) => Array.from(engine.getText(zone)).length)
    const caretsBefore = ZONES.map((zone) => carets[zone].value)
    const changed = direction === 'undo' ? engine.undo() : engine.redo()
    if (!changed) {
      refreshHistory()
      return false
    }

    ZONES.forEach((zone, index) => {
      const lengthAfter = Array.from(engine.getText(zone)).length
      const shifted = caretsBefore[index] + (lengthAfter - lengthsBefore[index])
      carets[zone].value = Math.max(0, Math.min(lengthAfter, shifted))
    })

    options.redraw()
    syncSelections()
    options.updateCaret()
    options.onFormatState(currentFormatState())
    options.scheduleSave()
    refreshHistory()
    return true
  }

  function undo() {
    return applyHistory('undo')
  }

  function redo() {
    return applyHistory('redo')
  }

  function setZone(zone: EditorZone, page?: number) {
    const zoneChanged = activeZone.value !== zone
    const pageChanged = page !== undefined && activePage.value !== page
    if (page !== undefined) activePage.value = page
    if (!zoneChanged && !pageChanged) return

    activeZone.value = zone
    if (zoneChanged) options.engine()?.checkpoint()
    options.onZoneChange()
    options.updateCaret()
    options.onFormatState(currentFormatState())
  }

  function setActivePage(page: number) {
    if (page === activePage.value) return
    activePage.value = Math.max(0, page)
    if (activeZone.value !== 'body') {
      options.updateCaret()
      options.onFormatState(currentFormatState())
    }
  }

  function clampActivePage(pageCount: number) {
    if (activePage.value >= pageCount) setActivePage(Math.max(0, pageCount - 1))
  }

  function handleMouseDown(zone: EditorZone, page: number, event: MouseEvent) {
    setZone(zone, page)
    selections[zone].handleMouseDown(event)
  }

  function handleMouseMove(event: MouseEvent) {
    for (const zone of ZONES) selections[zone].handleMouseMove(event)
  }

  function stopSelecting() {
    for (const zone of ZONES) selections[zone].stopSelecting()
  }

  function onKeydown(event: KeyboardEvent) {
    activeSelection.value.onKeydown(event)
  }

  function insertText(text: string) {
    activeSelection.value.insertText(text)
  }

  function selectedChars(): StyledChar[] {
    const engine = options.engine()
    const start = selectionStart.value
    const end = selectionEnd.value
    if (!engine || start >= end) return []
    return charsFromDelta(engine.getDelta(activeZone.value), start, end)
  }

  function deleteSelection(): boolean {
    const engine = options.engine()
    if (!engine) return false

    engine.checkpoint()
    if (!activeSelection.value.deleteSelection()) return false
    options.redraw()
    syncSelections()
    options.updateCaret()
    options.onFormatState(currentFormatState())
    options.scheduleSave()
    options.focus()
    return true
  }

  function pasteText(text: string) {
    const engine = options.engine()
    if (!engine || !text) return
    engine.checkpoint()
    activeSelection.value.insertText(text)
  }

  function pasteStyled(chars: StyledChar[]) {
    const base = options.engine()
    if (!base || chars.length === 0) return

    const zone = activeZone.value
    const engine = zonedEngine(zone)
    if (!engine) return

    engine.checkpoint()
    if (selectionStart.value !== selectionEnd.value) {
      activeSelection.value.deleteSelection()
    }

    const start = carets[zone].value
    carets[zone].value = insertStyledChars(engine, start, chars)
    options.redraw()
    syncSelections()
    options.updateCaret()
    options.onFormatState(currentFormatState())
    options.scheduleSave()
    options.focus()
  }

  function toggleMark(key: FormatKey) {
    activeSelection.value.toggleMark(key)
  }

  function setParagraphStyle(style: ParagraphStyle) {
    activeSelection.value.setParagraphStyle(style)
  }

  function toggleList(type: ListType) {
    activeSelection.value.toggleList(type)
  }

  function setAlignment(align: Alignment) {
    activeSelection.value.setAlignment(align)
  }

  function clampAll(body: number, header: number, footer: number) {
    selections.body.clampSelection(body)
    selections.header.clampSelection(header)
    selections.footer.clampSelection(footer)
  }

  function linesFor(zone: EditorZone): LineBox[] {
    return options.lines(zone, activePage.value)
  }

  function dispose() {
    if (checkpointTimer !== undefined) {
      clearTimeout(checkpointTimer)
      checkpointTimer = undefined
    }
  }

  return {
    activeZone,
    activePage,
    canUndo,
    canRedo,
    caretIndex,
    selectionStart,
    selectionEnd,
    currentFormatState,
    refreshHistory,
    undo,
    redo,
    setZone,
    clampActivePage,
    handleMouseDown,
    handleMouseMove,
    stopSelecting,
    onKeydown,
    insertText,
    selectedChars,
    deleteSelection,
    pasteText,
    pasteStyled,
    toggleMark,
    setParagraphStyle,
    toggleList,
    setAlignment,
    clampAll,
    linesFor,
    dispose,
  }
}

export type EditorZonesApi = ReturnType<typeof useEditorZones>
