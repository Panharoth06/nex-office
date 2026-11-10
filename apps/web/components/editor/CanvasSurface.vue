<template>
  <div
    ref="containerRef"
    class="relative flex flex-col items-center gap-8 select-none"
    @mousedown="handleMouseDown"
  >
    <!-- Hidden Proxy Input for IME & Keystrokes -->
    <EditorHiddenInput
      ref="hiddenInputRef"
      :cursor-x="caretPos.x"
      :cursor-y="caretPos.y"
      @input="onTextInput"
      @keydown="onKeydown"
      @composition="onComposition"
    />

    <!-- A4 Document Page Canvas (794 x 1123 px at 96 DPI) -->
    <div
      v-for="pageIndex in totalPages"
      :key="pageIndex"
      class="relative bg-white shadow-md border border-slate-200"
      :style="{ width: `${pageWidth}px`, height: `${pageHeight}px` }"
    >
      <!-- Layer 1: Static Background & Margin Grid (Cached) -->
      <canvas
        :ref="el => setCanvasRef(el, 'bg', pageIndex)"
        class="absolute inset-0 pointer-events-none"
        :width="pageWidth * dpr"
        :height="pageHeight * dpr"
        :style="{ width: `${pageWidth}px`, height: `${pageHeight}px` }"
      ></canvas>

      <!-- Layer 2: Document Surface (Skia / CanvasKit WebGL) -->
      <canvas
        :ref="el => setCanvasRef(el, 'doc', pageIndex)"
        class="absolute inset-0 pointer-events-none"
        :width="pageWidth * dpr"
        :height="pageHeight * dpr"
        :style="{ width: `${pageWidth}px`, height: `${pageHeight}px` }"
      ></canvas>

      <!-- Layer 3: Dynamic Overlay (Caret, Selections, Presence) -->
      <canvas
        :ref="el => setCanvasRef(el, 'overlay', pageIndex)"
        class="absolute inset-0 cursor-text"
        :width="pageWidth * dpr"
        :height="pageHeight * dpr"
        :style="{ width: `${pageWidth}px`, height: `${pageHeight}px` }"
      ></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EditorHiddenInput from './HiddenInput.vue'

const props = defineProps<{
  docId: string
}>()

// Page configuration: Standard A4 dimensions
const pageWidth = 794
const pageHeight = 1123
const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
const totalPages = ref(1)

// Dynamic Caret state
const caretPos = ref({ x: 96, y: 96 })
const hiddenInputRef = ref<InstanceType<typeof EditorHiddenInput> | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const canvasRefs: Record<string, HTMLCanvasElement> = {}

function setCanvasRef(el: any, layer: string, page: number) {
  if (el) {
    canvasRefs[`${layer}_${page}`] = el as HTMLCanvasElement
  }
}

function handleMouseDown(e: MouseEvent) {
  // Focus hidden input
  hiddenInputRef.value?.focus()

  // Calculate click position relative to page
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  caretPos.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

function onTextInput(text: string) {
  console.log('[Editor] Text input:', text)
  // Forward to Rust Wasm engine: engine.insert_text(...)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Backspace') {
    console.log('[Editor] Backspace')
    // Forward to Rust Wasm engine: engine.delete_range(...)
  }
}

function onComposition(text: string, isEnd: boolean) {
  console.log('[Editor] IME Composition:', text, 'isEnd:', isEnd)
}

onMounted(() => {
  hiddenInputRef.value?.focus()
})
</script>
