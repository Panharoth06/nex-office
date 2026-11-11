<template>
  <div
    class="hidden items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-1 md:flex"
    role="toolbar"
    aria-label="Text formatting"
  >
    <UiTooltip text="Bold">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Bold"
        :aria-pressed="formatState.bold"
        :class="activeClass(formatState.bold)"
        @mousedown.prevent
        @click="emit('format', 'bold')"
      >
        <Bold class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </UiTooltip>
    <UiTooltip text="Italic">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Italic"
        :aria-pressed="formatState.italic"
        :class="activeClass(formatState.italic)"
        @mousedown.prevent
        @click="emit('format', 'italic')"
      >
        <Italic class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </UiTooltip>
    <UiTooltip text="Underline">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Underline"
        :aria-pressed="formatState.underline"
        :class="activeClass(formatState.underline)"
        @mousedown.prevent
        @click="emit('format', 'underline')"
      >
        <Underline class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </UiTooltip>

    <span class="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />

    <UiSelect
      :model-value="formatState.paragraph"
      :options="paragraphOptions"
      variant="inline"
      aria-label="Paragraph style"
      :return-focus="false"
      @update:model-value="onParagraphChange"
    />

    <span class="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />

    <UiTooltip text="Bulleted list">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Bulleted list"
        :aria-pressed="formatState.list === 'ul'"
        :class="activeClass(formatState.list === 'ul')"
        @mousedown.prevent
        @click="emit('list', 'ul')"
      >
        <List class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </UiTooltip>
    <UiTooltip text="Numbered list">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Numbered list"
        :aria-pressed="formatState.list === 'ol'"
        :class="activeClass(formatState.list === 'ol')"
        @mousedown.prevent
        @click="emit('list', 'ol')"
      >
        <ListOrdered class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </UiTooltip>

    <span class="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />

    <UiTooltip text="Align left">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Align left"
        :aria-pressed="formatState.align === 'left'"
        :class="activeClass(formatState.align === 'left')"
        @mousedown.prevent
        @click="emit('align', 'left')"
      >
        <AlignLeft class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </UiTooltip>
    <UiTooltip text="Align center">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Align center"
        :aria-pressed="formatState.align === 'center'"
        :class="activeClass(formatState.align === 'center')"
        @mousedown.prevent
        @click="emit('align', 'center')"
      >
        <AlignCenter class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </UiTooltip>
    <UiTooltip text="Align right">
      <UiButton
        variant="ghost"
        size="icon"
        aria-label="Align right"
        :aria-pressed="formatState.align === 'right'"
        :class="activeClass(formatState.align === 'right')"
        @mousedown.prevent
        @click="emit('align', 'right')"
      >
        <AlignRight class="h-3.5 w-3.5" aria-hidden="true" />
      </UiButton>
    </UiTooltip>
  </div>
</template>

<script setup lang="ts">
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
} from 'lucide-vue-next'
import UiButton from '~/components/shared/UiButton.vue'
import UiSelect from '~/components/shared/UiSelect.vue'
import UiTooltip from '~/components/shared/UiTooltip.vue'
import type {
  Alignment,
  FormatKey,
  FormatState,
  ListType,
  ParagraphStyle,
} from '~/lib/editor/richText'

defineProps<{
  formatState: FormatState
}>()

const emit = defineEmits<{
  (e: 'format', key: FormatKey): void
  (e: 'paragraph', style: ParagraphStyle): void
  (e: 'list', type: ListType): void
  (e: 'align', align: Alignment): void
}>()

const paragraphOptions = [
  { value: 'normal', label: 'Normal text' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
] as const

function onParagraphChange(style: ParagraphStyle) {
  emit('paragraph', style)
}

function activeClass(active: boolean) {
  return active ? 'bg-slate-200 text-slate-900' : ''
}
</script>
