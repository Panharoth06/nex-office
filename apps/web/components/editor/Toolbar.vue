<template>
  <header class="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-xs">
    <div class="flex items-center gap-3">
      <NuxtLink to="/" class="text-slate-400 hover:text-slate-700">
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
        </div>
      </div>
    </div>

    <!-- Quick Action Formatting Bar -->
    <div class="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-md">
      <button class="px-2 py-1 text-xs font-bold hover:bg-white rounded transition">B</button>
      <button class="px-2 py-1 text-xs italic hover:bg-white rounded transition">I</button>
      <button class="px-2 py-1 text-xs underline hover:bg-white rounded transition">U</button>
      <span class="w-px h-4 bg-slate-200 mx-1"></span>
      <span class="text-xs text-slate-600 px-1">100%</span>
    </div>

    <div class="flex items-center gap-2">
      <span class="text-xs text-emerald-600 font-medium">● Saved</span>
    </div>
  </header>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
}>()

const localTitle = ref(props.title)
</script>
