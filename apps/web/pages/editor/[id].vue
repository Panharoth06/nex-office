<template>
  <div class="flex h-screen flex-col overflow-hidden bg-slate-100">
    <EditorToolbar
      :title="documentTitle"
      :doc-id="docId"
      :format-state="formatState"
      @rename="handleRename"
      @format="handleFormat"
      @paragraph="handleParagraph"
    />

    <div class="relative flex flex-1 justify-center overflow-auto px-4 py-8 oe-scroll">
      <div v-if="loading" class="flex items-center justify-center text-sm text-slate-400">
        Loading document…
      </div>
      <div
        v-else-if="loadError"
        class="flex max-w-md flex-col items-center justify-center gap-3 text-center text-sm text-slate-500"
      >
        <p>{{ loadError }}</p>
        <NuxtLink
          to="/"
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Back to documents
        </NuxtLink>
      </div>
      <ClientOnly v-else>
        <EditorCanvasSurface
          ref="canvasRef"
          :doc-id="docId"
          @format-state="formatState = $event"
        />
        <template #fallback>
          <div class="flex h-full items-center justify-center text-sm text-slate-400">
            Initializing Canvas Engine…
          </div>
        </template>
      </ClientOnly>
    </div>

    <div
      v-if="titleError"
      class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 shadow-lg"
      role="status"
    >
      {{ titleError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EditorToolbar from '~/components/editor/Toolbar.vue'
import EditorCanvasSurface from '~/components/editor/CanvasSurface.vue'
import { getDocument, renameDocument } from '~/lib/api/documents'
import { isNotFound, isUnauthorized } from '~/lib/api/client'
import {
  EMPTY_FORMAT_STATE,
  type FormatKey,
  type FormatState,
  type ParagraphStyle,
} from '~/lib/editor/richText'

const route = useRoute()
const docId = computed(() => (route.params.id as string) || 'untitled')

const documentTitle = ref('Untitled Document')
const formatState = ref<FormatState>({ ...EMPTY_FORMAT_STATE })
const canvasRef = ref<InstanceType<typeof EditorCanvasSurface> | null>(null)
const loading = ref(true)
const loadError = ref('')
const titleError = ref('')

onMounted(async () => {
  try {
    const detail = await getDocument(docId.value)
    documentTitle.value = detail.document.title
  } catch (err) {
    if (isUnauthorized(err)) {
      await navigateTo('/login')
      return
    }
    loadError.value = isNotFound(err)
      ? 'This document does not exist or you do not have access.'
      : 'Could not load this document.'
  } finally {
    loading.value = false
  }
})

function handleFormat(key: FormatKey) {
  canvasRef.value?.toggleMark(key)
}

function handleParagraph(style: ParagraphStyle) {
  canvasRef.value?.setParagraphStyle(style)
}

async function handleRename(title: string) {
  titleError.value = ''
  try {
    const updated = await renameDocument(docId.value, title)
    documentTitle.value = updated.title
  } catch {
    titleError.value = 'Could not rename this document.'
  }
}
</script>
