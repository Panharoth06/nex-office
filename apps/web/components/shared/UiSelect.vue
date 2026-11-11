<template>
  <div ref="root" class="relative inline-flex">
    <button
      ref="trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-label="ariaLabel || undefined"
      :disabled="disabled"
      :class="triggerClasses"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span
        class="truncate"
        :class="selected ? '' : 'text-slate-400'"
      >
        {{ selected?.label ?? placeholder }}
      </span>
      <ChevronDown
        class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform"
        :class="{ 'rotate-180': open }"
        aria-hidden="true"
      />
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="scale-95 opacity-0"
      enter-to-class="scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="scale-100 opacity-100"
      leave-to-class="scale-95 opacity-0"
    >
      <ul
        v-if="open"
        :id="listboxId"
        ref="listbox"
        role="listbox"
        :aria-label="ariaLabel || undefined"
        :class="[
          'oe-scroll absolute top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg',
          menuAlign === 'end' ? 'right-0' : 'left-0',
          variant === 'field' ? 'w-full' : 'min-w-[10rem]',
        ]"
      >
        <li
          v-for="(option, index) in options"
          :id="optionId(index)"
          :key="option.value"
          role="option"
          :aria-selected="option.value === model"
          :aria-disabled="option.disabled || undefined"
          :class="[
            'flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-xs transition',
            index === activeIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700',
            option.disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-slate-100',
          ]"
          @mouseenter="activeIndex = index"
          @mousedown.prevent
          @click="select(option)"
        >
          <span class="min-w-0">
            <span class="block truncate">{{ option.label }}</span>
            <span v-if="option.description" class="block truncate text-[10px] text-slate-400">
              {{ option.description }}
            </span>
          </span>
          <Check v-if="option.value === model" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import { useDismissable } from '~/composables/useDismissable'
import type { MenuAlign, SelectOption, SelectVariant } from '~/lib/ui/types'

const props = withDefaults(
  defineProps<{
    options: ReadonlyArray<SelectOption<T>>
    placeholder?: string
    variant?: SelectVariant
    menuAlign?: MenuAlign
    disabled?: boolean
    ariaLabel?: string
    returnFocus?: boolean
  }>(),
  {
    placeholder: 'Select…',
    variant: 'field',
    menuAlign: 'start',
    disabled: false,
    ariaLabel: '',
    returnFocus: true,
  },
)

const model = defineModel<T>({ required: true })
const open = ref(false)
const activeIndex = ref(0)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const listbox = ref<HTMLElement | null>(null)
const listboxId = `ui-select-${useId()}`

const selected = computed(() => props.options.find((option) => option.value === model.value))

const triggerVariants: Record<SelectVariant, string> = {
  field:
    'w-full justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs ' +
    'text-slate-700 transition hover:border-slate-400 focus:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
  inline:
    'justify-between gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-800 ' +
    'transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
  ghost:
    'justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs ' +
    'text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
}

const triggerClasses = computed(() => [
  'inline-flex items-center text-left transition',
  triggerVariants[props.variant],
  props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
])

function optionId(index: number) {
  return `${listboxId}-option-${index}`
}

function openMenu(index = -1) {
  if (props.disabled) return
  open.value = true
  const selectedIndex = props.options.findIndex((option) => option.value === model.value)
  activeIndex.value = index >= 0 ? index : Math.max(selectedIndex, 0)
}

function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}

function toggle() {
  if (open.value) close()
  else openMenu()
}

function select(option: SelectOption<T>) {
  if (option.disabled) return
  model.value = option.value
  close(props.returnFocus)
}

function moveActive(delta: number) {
  if (!open.value) {
    openMenu()
    return
  }
  const count = props.options.length
  if (count === 0) return
  let next = activeIndex.value
  for (let step = 0; step < count; step += 1) {
    next = (next + delta + count) % count
    if (!props.options[next]?.disabled) break
  }
  activeIndex.value = next
}

function onTriggerKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      moveActive(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      moveActive(-1)
      break
    case 'Home':
      if (!open.value) break
      event.preventDefault()
      activeIndex.value = 0
      break
    case 'End':
      if (!open.value) break
      event.preventDefault()
      activeIndex.value = props.options.length - 1
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (open.value) {
        const option = props.options[activeIndex.value]
        if (option) select(option)
      } else {
        openMenu()
      }
      break
    case 'Tab':
      close()
      break
  }
}

useDismissable(
  root,
  open,
  () => close(),
  () => close(true),
)

watch(activeIndex, async (index) => {
  if (!open.value) return
  await nextTick()
  listbox.value
    ?.querySelector<HTMLElement>(`#${CSS.escape(optionId(index))}`)
    ?.scrollIntoView({ block: 'nearest' })
})
</script>
