<template>
  <div class="h-screen flex flex-col bg-slate-100 overflow-hidden">
    <!-- Top Application Bar & Controls with Google Docs Share System -->
    <EditorToolbar :title="documentTitle" :doc-id="docId" />

    <!-- Document Scroll Viewport -->
    <div class="flex-1 overflow-auto flex justify-center py-8 px-4 relative">
      <ClientOnly>
        <EditorCanvasSurface :doc-id="docId" />
        <template #fallback>
          <div class="flex items-center justify-center h-full text-slate-400 text-sm">
            Initializing Canvas Engine...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import EditorToolbar from '~/components/editor/Toolbar.vue'
import EditorCanvasSurface from '~/components/editor/CanvasSurface.vue'

const route = useRoute()
const docId = computed(() => (route.params.id as string) || 'untitled')
const documentTitle = ref('Untitled Document')
</script>
