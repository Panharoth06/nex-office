<template>
  <div ref="root" class="relative inline-flex">
    <UiButton
      variant="ghost"
      size="sm"
      :disabled="disabled"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <slot name="icon" />
      {{ label }}
      <ChevronDown
        class="h-3 w-3 shrink-0 text-slate-400 transition-transform"
        :class="{ 'rotate-180': open }"
        aria-hidden="true"
      />
    </UiButton>

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
        :id="menuId"
        ref="menu"
        role="menu"
        :aria-label="label"
        :class="[
          'oe-scroll absolute top-full z-50 mt-1 max-h-72 min-w-[12rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg',
          menuAlign === 'end' ? 'right-0' : 'left-0',
        ]"
      >
        <template v-for="(item, index) in items" :key="`${item.label}-${index}`">
          <li v-if="item.separatorBefore" role="separator" class="my-1 h-px bg-slate-100" />
          <li role="none">
            <button
              type="button"
              role="menuitem"
              tabindex="-1"
              :disabled="item.disabled"
              :class="[
                'flex w-full items-center justify-between gap-6 rounded-md px-2.5 py-1.5 text-left text-xs transition',
                item.danger ? 'text-rose-600' : 'text-slate-700',
                index === activeIndex && !item.disabled
                  ? item.danger
                    ? 'bg-rose-50'
                    : 'bg-indigo-50 text-indigo-700'
                  : '',
                item.disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-slate-100',
              ]"
              @focus="activeIndex = index"
              @mouseenter="activeIndex = index"
              @click="choose(item)"
              @keydown="onItemKeydown($event, index)"
            >
              <span class="truncate">{{ item.label }}</span>
              <span v-if="item.shortcut" class="shrink-0 text-[10px] text-slate-400">
                {{ item.shortcut }}
              </span>
            </button>
          </li>
        </template>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useDismissable } from '~/composables/useDismissable'
import UiButton from '~/components/shared/UiButton.vue'
import type { MenuAlign, MenuItem } from '~/lib/ui/types'

const props = withDefaults(
  defineProps<{
    label: string
    items: ReadonlyArray<MenuItem>
    menuAlign?: MenuAlign
    disabled?: boolean
  }>(),
  {
    menuAlign: 'start',
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'select', item: MenuItem): void
}>()

const open = ref(false)
const activeIndex = ref(-1)
const root = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuId = `ui-menu-${useId()}`

function enabledIndexes() {
  return props.items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0)
}

function focusItem(index: number) {
  const buttons = menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
  buttons?.[index]?.focus()
}

async function openMenu() {
  if (props.disabled) return
  open.value = true
  const first = enabledIndexes()[0] ?? -1
  activeIndex.value = first
  await nextTick()
  focusItem(first)
}

function close(restoreFocus = false) {
  open.value = false
  activeIndex.value = -1
  if (restoreFocus) {
    root.value?.querySelector<HTMLButtonElement>('button')?.focus()
  }
}

function toggle() {
  if (open.value) close()
  else void openMenu()
}

function choose(item: MenuItem) {
  if (item.disabled) return
  emit('select', item)
  close(true)
}

function move(delta: number) {
  const enabled = enabledIndexes()
  if (enabled.length === 0) return
  const current = enabled.indexOf(activeIndex.value)
  const next = current === -1 ? 0 : (current + delta + enabled.length) % enabled.length
  activeIndex.value = enabled[next] ?? -1
  focusItem(activeIndex.value)
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    void openMenu()
  }
}

function onItemKeydown(event: KeyboardEvent, index: number) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Home': {
      event.preventDefault()
      const first = enabledIndexes()[0] ?? -1
      activeIndex.value = first
      focusItem(first)
      break
    }
    case 'End': {
      event.preventDefault()
      const enabled = enabledIndexes()
      const last = enabled[enabled.length - 1] ?? -1
      activeIndex.value = last
      focusItem(last)
      break
    }
    case 'Escape':
      event.preventDefault()
      close(true)
      break
    case 'Tab':
      close(true)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      choose(props.items[index] as MenuItem)
      break
  }
}

useDismissable(
  root,
  open,
  () => close(),
  () => close(true),
)

watch(open, (value) => {
  if (!value) activeIndex.value = -1
})
</script>
