<template>
  <div class="relative flex flex-col items-center gap-4 select-none">
    <div
      ref="pageRef"
      data-testid="editor-page"
      class="relative shrink-0 cursor-text"
      :style="{ width: `${pageWidth}px`, height: `${totalHeight}px` }"
      @mousedown="handlePageMouseDown"
      @mousemove="handleMouseMove"
    >
      <!-- Layer 1: static paper and margin guides -->
      <canvas
        ref="bgCanvas"
        class="absolute inset-0 pointer-events-none"
        :style="{ width: `${pageWidth}px`, height: `${totalHeight}px` }"
      ></canvas>

      <!-- Layer 2: document text -->
      <canvas
        ref="docCanvas"
        class="absolute inset-0 pointer-events-none"
        :style="{ width: `${pageWidth}px`, height: `${totalHeight}px` }"
      ></canvas>

      <!-- Layer 3: caret, zone guide, and IME preview -->
      <canvas
        ref="overlayCanvas"
        class="absolute inset-0 pointer-events-none"
        :style="{ width: `${pageWidth}px`, height: `${totalHeight}px` }"
      ></canvas>

      <!-- IME and keyboard proxy, positioned under the active caret -->
      <EditorHiddenInput
        ref="hiddenInputRef"
        :cursor-x="caret.x"
        :cursor-y="caret.y"
        @input="onTextInput"
        @keydown="onKeydown"
        @composition="onComposition"
      />

      <div
        v-if="!ready"
        class="absolute inset-0 flex items-center justify-center bg-white/85 px-8 text-center text-sm text-slate-500"
      >
        {{ error ?? 'Loading Rust engine…' }}
      </div>

      <div
        class="sr-only"
        aria-live="polite"
        data-testid="document-mirror"
        :data-caret="zones.caretIndex.value"
        :data-zone="zones.activeZone.value"
        :data-page="zones.activePage.value"
      >
        {{ mirrorText }}
      </div>
    </div>

    <p class="text-xs text-slate-400" data-testid="save-status">
      {{ saveLabel }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import EditorHiddenInput from './HiddenInput.vue'
import { loadEngine, type TextEngine } from '~/lib/editor/useEngine'
import type { Alignment, FormatState, ListType } from '~/lib/editor/richText'
import { zoneAtPoint } from '~/lib/editor/zones'
import type { LineBox } from '~/lib/editor/textLayout'
import { useEditorPainter } from '~/composables/useEditorPainter'
import {
  useEditorZones,
  type EditorZonesApi,
} from '~/composables/useEditorZones'
import { useSnapshotPersistence } from '~/composables/useSnapshotPersistence'
import { isUnauthorized } from '~/lib/api/client'

const props = defineProps<{ docId: string }>()

const emit = defineEmits<{
  (e: 'format-state', state: FormatState): void
  (e: 'history-state', state: { canUndo: boolean; canRedo: boolean }): void
}>()

const pageWidth = 794
const pageHeight = 1123
const pageGap = 32
const margin = 96
const lineHeight = 24
const stride = pageHeight + pageGap

const pageRef = ref<HTMLDivElement | null>(null)
const bgCanvas = ref<HTMLCanvasElement | null>(null)
const docCanvas = ref<HTMLCanvasElement | null>(null)
const overlayCanvas = ref<HTMLCanvasElement | null>(null)
const hiddenInputRef = ref<InstanceType<typeof EditorHiddenInput> | null>(null)

const engine = shallowRef<TextEngine | null>(null)
const ready = ref(false)
const error = ref<string | null>(null)

const {
  label: saveLabel,
  load: loadSnapshot,
  markLoaded: markSnapshotLoaded,
  schedule: scheduleSave,
  dispose: disposeSnapshotSaver,
} = useSnapshotPersistence(
  props.docId,
  () => engine.value,
  () => ready.value,
)

let zones!: EditorZonesApi

const painter = useEditorPainter({
  engine: () => engine.value,
  zones: () => zones,
  ready: () => ready.value,
  bgCanvas,
  docCanvas,
  overlayCanvas,
  pageWidth,
  pageHeight,
  pageGap,
  margin,
  lineHeight,
  onFormatState: emitFormatState,
})

zones = useEditorZones({
  engine: () => engine.value,
  lines: zoneLines,
  page: () => pageRef.value,
  context: () => painter.docContext.value,
  caretX: () => painter.caret.value.x,
  margin,
  ready: () => ready.value,
  focus,
  redraw: painter.redraw,
  updateCaret: painter.updateCaret,
  markTyped: painter.markTyped,
  scheduleSave,
  onFormatState: emitFormatState,
  onZoneChange: () => {
    painter.composing.value = ''
  },
})

const { caret, composing, mirrorText, totalHeight } = painter
let blinkTimer: number | undefined

watch(
  [zones.canUndo, zones.canRedo],
  ([canUndo, canRedo]) => {
    emit('history-state', { canUndo, canRedo })
  },
  { immediate: true },
)

onMounted(async () => {
  if (!bgCanvas.value || !docCanvas.value || !overlayCanvas.value) return

  painter.applyCanvasSize()
  painter.drawBackground()

  try {
    engine.value = await loadEngine()
    const snapshot = await loadSnapshot()
    if (snapshot) engine.value.importSnapshot(snapshot)
    markSnapshotLoaded()
    ready.value = true
    window.addEventListener('mouseup', zones.stopSelecting)
    painter.redraw()
    focus()
    blinkTimer = window.setInterval(() => {
      painter.toggleCaret()
    }, 500)
  } catch (err) {
    error.value = isUnauthorized(err)
      ? 'Sign in to open this document.'
      : err instanceof Error
        ? err.message
        : 'Failed to load the Rust engine'
  }
})

onBeforeUnmount(() => {
  if (blinkTimer !== undefined) window.clearInterval(blinkTimer)
  window.removeEventListener('mouseup', zones.stopSelecting)
  zones.dispose()
  disposeSnapshotSaver()
})

function zoneLines(zone: 'body' | 'header' | 'footer', page: number): LineBox[] {
  if (zone === 'body') return painter.bodyLines.value
  const all = zone === 'header' ? painter.headerLines.value : painter.footerLines.value
  return all.filter((line) => line.page === page)
}

function handlePageMouseDown(event: MouseEvent) {
  const page = pageRef.value
  if (!page || !ready.value) return
  const rect = page.getBoundingClientRect()
  const pageY = event.clientY - rect.top
  if (pageY < 0 || pageY > painter.totalHeight.value) return

  const pageIndex = Math.min(
    Math.max(Math.floor(pageY / stride), 0),
    painter.pageCount.value - 1,
  )
  const localY = pageY - pageIndex * stride
  if (localY < 0 || localY > pageHeight) return

  const zone = zoneAtPoint(
    localY,
    painter.bodyContentTop.value,
    painter.bodyContentBottom.value,
    pageHeight,
  )
  zones.handleMouseDown(zone, pageIndex, event)
}

function handleMouseMove(event: MouseEvent) {
  zones.handleMouseMove(event)
}

function emitFormatState(state: FormatState) {
  emit('format-state', state)
}

function focus() {
  hiddenInputRef.value?.focus()
}

function onTextInput(text: string) {
  if (text) zones.insertText(text)
}

function onKeydown(event: KeyboardEvent) {
  zones.onKeydown(event)
}

function onComposition(text: string, isEnd: boolean) {
  if (!isEnd) {
    composing.value = text
    painter.drawOverlay()
    return
  }

  composing.value = ''
  if (text) onTextInput(text)
}

defineExpose({
  toggleMark: zones.toggleMark,
  setParagraphStyle: zones.setParagraphStyle,
  toggleList: (type: ListType) => zones.toggleList(type),
  setAlignment: (align: Alignment) => zones.setAlignment(align),
  undo: zones.undo,
  redo: zones.redo,
})
</script>
