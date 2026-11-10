<template>
  <header class="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-xs">
    <div class="flex items-center gap-3">
      <NuxtLink to="/" class="text-slate-400 hover:text-slate-700 font-bold px-1">
        ←
      </NuxtLink>
      <div>
        <input
          v-model="localTitle"
          class="text-sm font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden px-1 py-0.5 rounded"
        />
        <div class="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
          <button class="hover:text-slate-700">File</button>
          <button class="hover:text-slate-700">Edit</button>
          <button class="hover:text-slate-700">View</button>
          <button class="hover:text-slate-700">Insert</button>
          <button class="hover:text-slate-700">Format</button>
          <button class="hover:text-slate-700">Tools</button>
        </div>
      </div>
    </div>

    <!-- Quick Action Formatting Bar -->
    <div class="hidden md:flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-md">
      <button class="px-2 py-1 text-xs font-bold hover:bg-white rounded transition">B</button>
      <button class="px-2 py-1 text-xs italic hover:bg-white rounded transition">I</button>
      <button class="px-2 py-1 text-xs underline hover:bg-white rounded transition">U</button>
      <span class="w-px h-4 bg-slate-200 mx-1"></span>
      <select class="text-xs bg-transparent border-none text-slate-600 focus:outline-hidden cursor-pointer">
        <option>Normal text</option>
        <option>Heading 1</option>
        <option>Heading 2</option>
        <option>Heading 3</option>
      </select>
    </div>

    <!-- Right Controls: Active Collaborators & Google Docs Share Button -->
    <div class="flex items-center gap-3">
      <!-- Active Presence Avatars -->
      <div class="flex items-center -space-x-1.5">
        <div class="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-2xs flex items-center justify-center border-2 border-white ring-1 ring-slate-200" title="Alice Smith (Editing)">
          AS
        </div>
        <div class="w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-2xs flex items-center justify-center border-2 border-white ring-1 ring-slate-200" title="Bob Jones (Viewing)">
          BJ
        </div>
      </div>

      <!-- Google Docs-Style Share Button -->
      <button
        @click="isShareOpen = true"
        class="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-xs transition"
      >
        <span>🔒 Share</span>
      </button>

      <!-- Share Modal -->
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
import { ref } from 'vue'
import EditorShareModal from './ShareModal.vue'

const props = defineProps<{
  title: string
  docId: string
}>()

const localTitle = ref(props.title)
const isShareOpen = ref(false)
</script>
