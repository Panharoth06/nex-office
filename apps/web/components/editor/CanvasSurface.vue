<template>
  <div class="relative flex flex-col items-center gap-4 select-none">
    <div
      ref="pageRef"
      data-testid="editor-page"
      class="relative shrink-0 cursor-text"
      :style="{ width: `${pageWidth}px`, height: `${totalHeight}px` }"
      @mousedown="handleMouseDown"
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

      <!-- Layer 3: caret and IME preview -->
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
        :data-caret="caretIndex"
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
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import EditorHiddenInput from './HiddenInput.vue'
import { layoutChars, caretRect, type LineBox } from '~/lib/editor/textLayout'
import { drawPageBackground, setupCanvas } from '~/lib/editor/canvas'
import { loadEngine, type TextEngine } from '~/lib/editor/useEngine'
import {
  styledCharsFromDelta,
  type Alignment,
  type FormatState,
  type ListType,
} from '~/lib/editor/richText'
import { drawRichDocument } from '~/lib/editor/renderDocument'
import { useEditorSelection } from '~/composables/useEditorSelection'
import { useSnapshotPersistence } from '~/composables/useSnapshotPersistence'
import { isUnauthorized } from '~/lib/api/client'

const props = defineProps<{ docId: string }>()

const emit = defineEmits<{
  (e: 'format-state', state: FormatState): void
}>()

const pageWidth = 794
const pageHeight = 1123
const pageGap = 32
const margin = 96
const lineHeight = 24
const font = '16px "Helvetica Neue", Arial, "Noto Sans CJK SC", "Noto Sans", sans-serif'
const contentWidth = pageWidth - margin * 2
const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

const pageRef = ref<HTMLDivElement | null>(null)
const bgCanvas = ref<HTMLCanvasElement | null>(null)
const docCanvas = ref<HTMLCanvasElement | null>(null)
const overlayCanvas = ref<HTMLCanvasElement | null>(null)
const hiddenInputRef = ref<InstanceType<typeof EditorHiddenInput> | null>(null)

const engine = shallowRef<TextEngine | null>(null)
const lines = shallowRef<LineBox[]>([])
const caretIndex = ref(0)
const caret = ref({ x: margin, y: margin, height: lineHeight })
const composing = ref('')
const mirrorText = ref('')
const ready = ref(false)
const error = ref<string | null>(null)
const pageCount = ref(1)
const totalHeight = computed(
  () => pageCount.value * pageHeight + (pageCount.value - 1) * pageGap,
)
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

const {
  selectionStart,
  selectionEnd,
  currentFormatState,
  setParagraphStyle,
  toggleList,
  setAlignment,
  insertText,
  clampSelection,
  toggleMark,
  onKeydown,
  handleMouseDown,
  handleMouseMove,
  stopSelecting,
} = useEditorSelection({
  engine: () => engine.value,
  lines: () => lines.value,
  context: () => docCtx,
  page: () => pageRef.value,
  caretIndex,
  caretX: () => caret.value.x,
  margin,
  ready: () => ready.value,
  focus,
  redraw,
  updateCaret,
  markTyped,
  scheduleSave,
  onFormatState: emitFormatState,
})

let docCtx: CanvasRenderingContext2D | null = null
let overlayCtx: CanvasRenderingContext2D | null = null
let blinkTimer: number | undefined
let caretVisible = true

onMounted(async () => {
  if (!bgCanvas.value || !docCanvas.value || !overlayCanvas.value) return

  applyCanvasSize()
  drawBackground()

  try {
    engine.value = await loadEngine()
    const snapshot = await loadSnapshot()
    if (snapshot) engine.value.importSnapshot(snapshot)
    markSnapshotLoaded()
    ready.value = true
    window.addEventListener('mouseup', stopSelecting)
    redraw()
    focus()
    blinkTimer = window.setInterval(() => {
      caretVisible = !caretVisible
      drawOverlay()
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
  if (blinkTimer !== undefined) {
    window.clearInterval(blinkTimer)
  }
  window.removeEventListener('mouseup', stopSelecting)
  disposeSnapshotSaver()
})

function applyCanvasSize() {
  const canvases = [bgCanvas.value, docCanvas.value, overlayCanvas.value]
  for (const canvas of canvases) {
    if (!canvas) return
    canvas.width = pageWidth * dpr
    canvas.height = totalHeight.value * dpr
    canvas.style.width = `${pageWidth}px`
    canvas.style.height = `${totalHeight.value}px`
  }

  if (bgCanvas.value) setupCanvas(bgCanvas.value, dpr)
  if (docCanvas.value) docCtx = setupCanvas(docCanvas.value, dpr)
  if (overlayCanvas.value) overlayCtx = setupCanvas(overlayCanvas.value, dpr)
}

function drawBackground() {
  const canvas = bgCanvas.value
  if (!canvas) return
  drawPageBackground(canvas.getContext('2d')!, {
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    pageCount: pageCount.value,
    pageGap,
  })
}

function redraw() {
  if (!docCtx || !engine.value) return

  const text = engine.value.getText()
  const delta = engine.value.getDelta()
  let chars = styledCharsFromDelta(delta)
  if (chars.length !== Array.from(text).length) {
    chars = Array.from(text).map((char) => ({ char, style: {} }))
  }

  clampSelection(chars.length)
  mirrorText.value = text
  composing.value = ''

  const nextLines = layoutChars(docCtx, chars, contentWidth, lineHeight, margin, {
    pageHeight,
    marginTop: margin,
    marginBottom: margin,
    pageGap,
  })
  const nextPageCount = nextLines.length
    ? nextLines[nextLines.length - 1].page + 1
    : 1

  if (nextPageCount !== pageCount.value) {
    pageCount.value = nextPageCount
    applyCanvasSize()
    drawBackground()
  }

  docCtx.clearRect(0, 0, pageWidth, totalHeight.value)
  docCtx.textBaseline = 'top'
  docCtx.textAlign = 'left'

  lines.value = nextLines
  drawRichDocument(docCtx, lines.value, {
    selectionStart: selectionStart.value,
    selectionEnd: selectionEnd.value,
    margin,
  })

  updateCaret()
  markTyped()
}

function updateCaret() {
  if (!docCtx) return
  caret.value = caretRect(docCtx, lines.value, caretIndex.value, margin)
  emitFormatState()
}

function drawOverlay() {
  if (!overlayCtx) return

  overlayCtx.clearRect(0, 0, pageWidth, totalHeight.value)

  if (ready.value && caretVisible) {
    overlayCtx.fillStyle = '#2563eb'
    overlayCtx.fillRect(caret.value.x, caret.value.y, 2, caret.value.height)
  }

  if (composing.value) {
    overlayCtx.font = font
    overlayCtx.fillStyle = '#94a3b8'
    overlayCtx.textBaseline = 'top'
    overlayCtx.fillText(composing.value, caret.value.x + 2, caret.value.y)
    overlayCtx.fillRect(
      caret.value.x + 2,
      caret.value.y + caret.value.height - 2,
      overlayCtx.measureText(composing.value).width,
      1,
    )
  }
}

function markTyped() {
  caretVisible = true
  drawOverlay()
}

function emitFormatState() {
  emit('format-state', currentFormatState())
}

function focus() {
  hiddenInputRef.value?.focus()
}

function onTextInput(text: string) {
  if (!text) return
  insertText(text)
}


function onComposition(text: string, isEnd: boolean) {
  if (!isEnd) {
    composing.value = text
    drawOverlay()
    return
  }

  composing.value = ''
  if (text) onTextInput(text)
}

defineExpose({
  toggleMark,
  setParagraphStyle,
  toggleList: (type: ListType) => toggleList(type),
  setAlignment: (align: Alignment) => setAlignment(align),
})

</script>
