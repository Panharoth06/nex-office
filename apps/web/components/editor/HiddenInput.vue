<template>
  <textarea
    ref="inputRef"
    class="absolute opacity-0 pointer-events-none z-50 resize-none overflow-hidden"
    :style="{
      left: `${cursorX}px`,
      top: `${cursorY}px`,
      width: '1px',
      height: '20px',
    }"
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    spellcheck="false"
    aria-label="Document editor input"
    @input="handleInput"
    @keydown="handleKeydown"
    @copy="emit('copy', $event)"
    @cut="emit('cut', $event)"
    @paste="emit('paste', $event)"
    @compositionstart="handleCompositionStart"
    @compositionupdate="handleCompositionUpdate"
    @compositionend="handleCompositionEnd"
  ></textarea>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  cursorX: number
  cursorY: number
}>()

const emit = defineEmits<{
  (e: 'input', text: string): void
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'copy', event: ClipboardEvent): void
  (e: 'cut', event: ClipboardEvent): void
  (e: 'paste', event: ClipboardEvent): void
  (e: 'composition', text: string, isEnd: boolean): void
}>()

const inputRef = ref<HTMLTextAreaElement | null>(null)
let isComposing = false

function focus() {
  inputRef.value?.focus()
}

function handleInput(e: Event) {
  if (isComposing) return
  const target = e.target as HTMLTextAreaElement
  if (target.value) {
    emit('input', target.value)
    target.value = ''
  }
}

function handleKeydown(e: KeyboardEvent) {
  emit('keydown', e)
}

function handleCompositionStart() {
  isComposing = true
}

function handleCompositionUpdate(e: CompositionEvent) {
  emit('composition', e.data || '', false)
}

function handleCompositionEnd(e: CompositionEvent) {
  isComposing = false
  emit('composition', e.data || '', true)
  if (inputRef.value) {
    inputRef.value.value = ''
  }
}

defineExpose({
  focus,
})
</script>
