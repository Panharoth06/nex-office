import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type {
  Alignment,
  FormatKey,
  FormatState,
  ListType,
  ParagraphStyle,
} from '~/lib/editor/richText'
import type { LineBox } from '~/lib/editor/textLayout'
import { engineForZone, type TextEngine } from '~/lib/editor/useEngine'
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
  clampSelection: (max: number) => void
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
  const carets: Record<EditorZone, Ref<number>> = {
    body: ref(0),
    header: ref(0),
    footer: ref(0),
  }

  function zonedEngine(zone: EditorZone): TextEngine | null {
    const base = options.engine()
    return base ? engineForZone(base, zone) : null
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
  const hasSelection = computed(() => selectionStart.value !== selectionEnd.value)
  const caretIndex = computed(() => carets[activeZone.value].value)

  function currentFormatState(): FormatState {
    return activeSelection.value.currentFormatState()
  }

  function setZone(zone: EditorZone, page?: number) {
    const zoneChanged = activeZone.value !== zone
    const pageChanged = page !== undefined && activePage.value !== page
    if (page !== undefined) activePage.value = page
    if (!zoneChanged && !pageChanged) return

    activeZone.value = zone
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

  return {
    activeZone,
    activePage,
    caretIndex,
    selectionStart,
    selectionEnd,
    hasSelection,
    currentFormatState,
    setZone,
    setActivePage,
    clampActivePage,
    handleMouseDown,
    handleMouseMove,
    stopSelecting,
    onKeydown,
    insertText,
    toggleMark,
    setParagraphStyle,
    toggleList,
    setAlignment,
    clampAll,
    linesFor,
  }
}

export type EditorZonesApi = ReturnType<typeof useEditorZones>
