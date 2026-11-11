<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
        @mousedown.self="onBackdrop"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="labelledBy || undefined"
          class="w-full max-w-md rounded-2xl border border-slate-100 bg-white shadow-xl"
          @keydown="onPanelKeydown"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    labelledBy?: string
    closeOnBackdrop?: boolean
  }>(),
  {
    labelledBy: '',
    closeOnBackdrop: true,
  },
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const panel = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null
let previousOverflow = ''

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements() {
  if (!panel.value) return []
  return Array.from(panel.value.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.offsetParent !== null,
  )
}

async function activate() {
  previouslyFocused = document.activeElement as HTMLElement | null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  await nextTick()
  focusableElements()[0]?.focus()
}

function restore() {
  document.body.style.overflow = previousOverflow
  previouslyFocused?.focus()
  previouslyFocused = null
}

function onBackdrop() {
  if (props.closeOnBackdrop) emit('close')
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return

  const focusables = focusableElements()
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusables[0] as HTMLElement
  const last = focusables[focusables.length - 1] as HTMLElement
  const active = document.activeElement

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  (value) => {
    if (typeof document === 'undefined') return
    if (value) void activate()
    else restore()
  },
  { immediate: true },
)

onBeforeUnmount(restore)
</script>
