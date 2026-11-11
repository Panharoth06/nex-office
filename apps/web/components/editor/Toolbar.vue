<template>
  <header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
    <div class="flex items-center gap-3">
      <NuxtLink
        to="/"
        class="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Back to dashboard"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      </NuxtLink>

      <div>
        <UiTextField
          v-model="localTitle"
          variant="title"
          aria-label="Document title"
          class="w-56"
          @blur="commitTitle"
          @keydown.enter="onTitleEnter"
        />
        <div class="mt-1 flex items-center gap-0.5">
          <UiMenu
            v-for="menu in menus"
            :key="menu.label"
            :label="menu.label"
            :items="menu.items"
            @select="onMenuSelect"
          />
        </div>
      </div>
    </div>

    <!-- Quick Action Formatting Bar -->
    <div class="hidden items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-1 md:flex">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Bold"
        @mousedown.prevent
        :aria-pressed="formatState.bold"
        @click="emit('format', 'bold')"
      >
        <Bold class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Italic"
        @mousedown.prevent
        :aria-pressed="formatState.italic"
        @click="emit('format', 'italic')"
      >
        <Italic class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Underline"
        @mousedown.prevent
        :aria-pressed="formatState.underline"
        @click="emit('format', 'underline')"
      >
        <Underline class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>

      <span class="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />

      <UiSelect
        :model-value="formatState.paragraph"
        :options="paragraphOptions"
        variant="inline"
        aria-label="Paragraph style"
        @update:model-value="onParagraphChange"
      />
    </div>

    <!-- Right Controls: Active Collaborators & Share Button -->
    <div class="flex items-center gap-3">
      <div class="flex items-center -space-x-1.5">
        <UiTooltip text="Alice Smith · Editing">
          <span
            tabindex="0"
            class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[10px] font-bold text-white ring-1 ring-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Alice Smith, editing"
          >
            AS
          </span>
        </UiTooltip>
        <UiTooltip text="Bob Jones · Viewing">
          <span
            tabindex="0"
            class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[10px] font-bold text-white ring-1 ring-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Bob Jones, viewing"
          >
            BJ
          </span>
        </UiTooltip>
      </div>

      <UiButton
        variant="primary"
        size="sm"
        class="!rounded-full px-3.5"
        @click="isShareOpen = true"
      >
        <Lock class="h-3 w-3" aria-hidden="true" />
        Share
      </UiButton>

      <EditorShareModal
        :is-open="isShareOpen"
        :document-title="localTitle"
        :doc-id="docId"
        @close="isShareOpen = false"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowLeft, Bold, Italic, Lock, Underline } from 'lucide-vue-next'
import EditorShareModal from './ShareModal.vue'
import UiButton from '~/components/shared/UiButton.vue'
import UiMenu from '~/components/shared/UiMenu.vue'
import UiSelect from '~/components/shared/UiSelect.vue'
import UiTextField from '~/components/shared/UiTextField.vue'
import UiTooltip from '~/components/shared/UiTooltip.vue'
import type { MenuItem } from '~/lib/ui/types'
import type { ParagraphStyle } from '~/lib/editor/richText'

const props = withDefaults(
  defineProps<{
    title: string
    docId: string
    formatState: {
      bold: boolean
      italic: boolean
      underline: boolean
      paragraph: ParagraphStyle
    }
  }>(),
  {
    formatState: () => ({
      bold: false,
      italic: false,
      underline: false,
      paragraph: 'normal',
    }),
  },
)

const emit = defineEmits<{
  (e: 'rename', title: string): void
  (e: 'format', key: 'bold' | 'italic' | 'underline'): void
  (e: 'paragraph', style: ParagraphStyle): void
}>()

const localTitle = ref(props.title)
const lastSavedTitle = ref(props.title)
const isShareOpen = ref(false)

watch(
  () => props.title,
  (title) => {
    localTitle.value = title
    lastSavedTitle.value = title
  },
)

function commitTitle() {
  const title = localTitle.value.trim() || 'Untitled Document'
  localTitle.value = title
  if (title === lastSavedTitle.value) return
  lastSavedTitle.value = title
  emit('rename', title)
}

function onParagraphChange(style: ParagraphStyle) {
  emit('paragraph', style)
}

function onTitleEnter(event: KeyboardEvent) {
  const target = event.target
  if (target instanceof HTMLInputElement) target.blur()
}

const paragraphOptions = [
  { value: 'normal', label: 'Normal text' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
] as const

const menus: ReadonlyArray<{ label: string; items: MenuItem[] }> = [
  {
    label: 'File',
    items: [
      { label: 'New document', shortcut: '⌘N' },
      { label: 'Open', shortcut: '⌘O' },
      { label: 'Rename' },
      { label: 'Make a copy' },
      { label: 'Move to trash', separatorBefore: true, danger: true },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: '⌘Z' },
      { label: 'Redo', shortcut: '⇧⌘Z' },
      { label: 'Cut', shortcut: '⌘X', separatorBefore: true },
      { label: 'Copy', shortcut: '⌘C' },
      { label: 'Paste', shortcut: '⌘V' },
      { label: 'Find and replace', shortcut: '⌘H', separatorBefore: true },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Print layout' },
      { label: 'Full screen' },
    ],
  },
  {
    label: 'Insert',
    items: [
      { label: 'Image' },
      { label: 'Table' },
      { label: 'Chart' },
      { label: 'Horizontal line' },
    ],
  },
  {
    label: 'Format',
    items: [
      { label: 'Bold', shortcut: '⌘B' },
      { label: 'Italic', shortcut: '⌘I' },
      { label: 'Underline', shortcut: '⌘U' },
      { label: 'Clear formatting', shortcut: '⌘\\', separatorBefore: true },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Spelling and grammar' },
      { label: 'Word count', shortcut: '⌘⇧C' },
      { label: 'Preferences' },
    ],
  },
]

function onMenuSelect(item: MenuItem) {
  console.debug('[toolbar] menu action', item.label)
}
</script>
