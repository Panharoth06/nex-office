<template>
  <span
    ref="root"
    class="relative inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <span
        v-if="visible"
        :id="tooltipId"
        role="tooltip"
        class="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white shadow-lg"
      >
        {{ text }}
      </span>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'

defineProps<{
  text: string
}>()

const visible = ref(false)
const tooltipId = `ui-tooltip-${useId()}`

function show() {
  visible.value = true
}

function hide() {
  visible.value = false
}
</script>
