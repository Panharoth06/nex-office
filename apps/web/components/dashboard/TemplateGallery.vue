<template>
  <section class="border-b border-slate-200 py-6">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-800">Start a new document</h2>
      <UiButton variant="ghost" size="sm" @click="galleryOpen = !galleryOpen">
        <LayoutGrid class="h-3.5 w-3.5" aria-hidden="true" />
        Template gallery
        <ChevronDown
          class="h-3 w-3 transition-transform"
          :class="{ 'rotate-180': galleryOpen }"
          aria-hidden="true"
        />
      </UiButton>
    </div>

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      <UiButton
        v-for="template in templates"
        :key="template.id"
        variant="unstyled"
        class="group block"
        @click="createFromTemplate(template)"
      >
        <div
          class="flex aspect-[3/4] items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition group-hover:border-indigo-500 group-hover:shadow-md"
        >
          <span v-if="template.id === 'blank'" class="text-3xl font-light text-indigo-600">+</span>
          <div v-else class="flex h-full w-full flex-col justify-between p-3">
            <div class="space-y-1.5">
              <div
                class="h-2 rounded"
                :class="template.accent ? 'bg-indigo-600' : 'bg-slate-800'"
                :style="{ width: template.titleWidth }"
              />
              <div class="h-1 w-20 rounded bg-slate-300" />
              <div class="my-2 h-px bg-slate-200" />
              <div class="h-1 w-24 rounded bg-slate-200" />
              <div class="h-1 w-16 rounded bg-slate-200" />
              <div class="h-1 w-[4.5rem] rounded bg-slate-200" />
            </div>
            <div
              class="h-1 rounded"
              :class="template.accent ? 'bg-indigo-300' : 'bg-slate-400'"
              :style="{ width: template.footerWidth }"
            />
          </div>
        </div>
        <p class="mt-2 text-xs font-medium text-slate-800">{{ template.label }}</p>
      </UiButton>
    </div>

    <p v-if="galleryOpen" class="mt-3 text-[10px] text-slate-400">
      More templates will load from the template API once M2 lands.
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, LayoutGrid } from 'lucide-vue-next'
import UiButton from '~/components/shared/UiButton.vue'

interface TemplateCard {
  id: string
  label: string
  accent: boolean
  titleWidth: string
  footerWidth: string
}

const emit = defineEmits<{
  (e: 'create', template: { id: string; title: string }): void
}>()

const galleryOpen = ref(false)

const templates: ReadonlyArray<TemplateCard> = [
  { id: 'blank', label: 'Blank document', accent: false, titleWidth: '4rem', footerWidth: '3rem' },
  { id: 'resume', label: 'Modern Resume', accent: true, titleWidth: '4rem', footerWidth: '3rem' },
  { id: 'proposal', label: 'Project Proposal', accent: true, titleWidth: '5rem', footerWidth: '4rem' },
  { id: 'notes', label: 'Meeting Notes', accent: false, titleWidth: '3.5rem', footerWidth: '3.5rem' },
  { id: 'letter', label: 'Formal Letter', accent: false, titleWidth: '2rem', footerWidth: '2.5rem' },
]

function createFromTemplate(template: TemplateCard) {
  emit('create', {
    id: template.id,
    title: template.id === 'blank' ? 'Untitled Document' : template.label,
  })
}
</script>
