<template>
  <div class="relative flex flex-col items-center gap-4 select-none">
    <div
      ref="pageRef"
      data-testid="editor-page"
      class="relative shrink-0 bg-white shadow-md border border-slate-200 cursor-text"
      :style="{ width: `${pageWidth}px`, height: `${pageHeight}px` }"
      @mousedown="handleMouseDown"
    >
      <!-- Layer 1: static paper and margin guides -->
      <canvas
        ref="bgCanvas"
        class="absolute inset-0 pointer-events-none"
        :width="pageWidth * dpr"
        :height="pageHeight * dpr"
        :style="{ width: `${pageWidth}px`, height: `${pageHeight}px` }"
      ></canvas>

      <!-- Layer 2: document text -->
      <canvas
        ref="docCanvas"
        class="absolute inset-0 pointer-events-none"
        :width="pageWidth * dpr"
        :height="pageHeight * dpr"
        :style="{ width: `${pageWidth}px`, height: `${pageHeight}px` }"
      ></canvas>

      <!-- Layer 3: caret and IME preview -->
      <canvas
        ref="overlayCanvas"
        class="absolute inset-0 pointer-events-none"
        :width="pageWidth * dpr"
        :height="pageHeight * dpr"
        :style="{ width: `${pageWidth}px`, height: `${pageHeight}px` }"
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
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import EditorHiddenInput from './HiddenInput.vue'
import { layoutChars, caretRect, hitTestChar, lineForIndex, type LineBox } from '~/lib/editor/textLayout'
import { drawPageBackground, setupCanvas } from '~/lib/editor/canvas'
import { loadEngine, type TextEngine } from '~/lib/editor/useEngine'
import {
  formatStateForRange,
  styledCharsFromDelta,
  type FormatState,
  type TextDeltaSegment,
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
  deleteSelection,
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
  lineHeight,
  ready: () => ready.value,
  focus,
  redraw,
  updateCaret,
  markTyped,
  scheduleSave,
  insertText: onTextInput,
})

let docCtx: CanvasRenderingContext2D | null = null
let overlayCtx: CanvasRenderingContext2D | null = null
let blinkTimer: number | undefined
let caretVisible = true

onMounted(async () => {
  const bg = bgCanvas.value
  const doc = docCanvas.value
  const overlay = overlayCanvas.value
  if (!bg || !doc || !overlay) return

  setupCanvas(bg, dpr)
  docCtx = setupCanvas(doc, dpr)
  overlayCtx = setupCanvas(overlay, dpr)

  drawPageBackground(bg.getContext('2d')!, { pageWidth, pageHeight, margin, contentWidth })

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

  docCtx.clearRect(0, 0, pageWidth, pageHeight)
  docCtx.textBaseline = 'top'
  docCtx.textAlign = 'left'

  lines.value = layoutChars(docCtx, chars, contentWidth, lineHeight, margin)
  drawRichDocument(docCtx, lines.value, {
    selectionStart: selectionStart.value,
    selectionEnd: selectionEnd.value,
    margin,
    lineHeight,
  })

  updateCaret(delta)
  markTyped()
}

function updateCaret(delta?: TextDeltaSegment[]) {
  if (!docCtx) return
  caret.value = caretRect(docCtx, lines.value, caretIndex.value, margin, lineHeight)
  emitFormatState(delta)
}

function drawOverlay() {
  if (!overlayCtx) return

  overlayCtx.clearRect(0, 0, pageWidth, pageHeight)

  if (ready.value && caretVisible) {
    overlayCtx.fillStyle = '#2563eb'
    overlayCtx.fillRect(caret.value.x, caret.value.y, 2, lineHeight)
  }

  if (composing.value) {
    overlayCtx.font = font
    overlayCtx.fillStyle = '#94a3b8'
    overlayCtx.textBaseline = 'top'
    overlayCtx.fillText(composing.value, caret.value.x + 2, caret.value.y)
    overlayCtx.fillRect(
      caret.value.x + 2,
      caret.value.y + lineHeight - 2,
      overlayCtx.measureText(composing.value).width,
      1,
    )
  }
}

function markTyped() {
  caretVisible = true
  drawOverlay()
}

function emitFormatState(delta?: TextDeltaSegment[]) {
  if (!engine.value) return
  emit(
    'format-state',
    formatStateForRange(
      delta ?? engine.value.getDelta(),
      selectionStart.value,
      selectionEnd.value,
    ),
  )
}

function focus() {
  hiddenInputRef.value?.focus()
}

function onTextInput(text: string) {
  if (!engine.value || !text) return

  deleteSelection()
  engine.value.insertText(caretIndex.value, text)
  caretIndex.value += Array.from(text).length
  composing.value = ''
  redraw()
  scheduleSave()
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

defineExpose({ toggleMark })
</script>
