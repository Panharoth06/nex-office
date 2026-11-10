<template>
  <section class="py-6 border-b border-slate-200">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-semibold text-slate-800">Start a new document</h2>
      <button class="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Template gallery ↕</button>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      <!-- Blank Template -->
      <button
        @click="createFromTemplate('blank')"
        class="group text-left"
      >
        <div class="aspect-3/4 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-2xs group-hover:border-indigo-500 transition">
          <span class="text-3xl text-indigo-600 font-light">+</span>
        </div>
        <p class="text-xs font-medium text-slate-800 mt-2">Blank document</p>
      </button>

      <!-- Resume Template -->
      <button
        @click="createFromTemplate('resume')"
        class="group text-left"
      >
        <div class="aspect-3/4 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs group-hover:border-indigo-500 transition flex flex-col justify-between">
          <div class="space-y-1.5">
            <div class="h-2 w-16 bg-slate-800 rounded"></div>
            <div class="h-1 w-20 bg-slate-300 rounded"></div>
            <div class="h-px bg-slate-200 my-2"></div>
            <div class="h-1 w-24 bg-slate-200 rounded"></div>
            <div class="h-1 w-16 bg-slate-200 rounded"></div>
          </div>
          <div class="h-1 w-12 bg-indigo-300 rounded"></div>
        </div>
        <p class="text-xs font-medium text-slate-800 mt-2">Modern Resume</p>
      </button>

      <!-- Project Proposal -->
      <button
        @click="createFromTemplate('proposal')"
        class="group text-left"
      >
        <div class="aspect-3/4 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs group-hover:border-indigo-500 transition flex flex-col justify-between">
          <div class="space-y-1.5">
            <div class="h-2 w-20 bg-indigo-600 rounded"></div>
            <div class="h-1 w-24 bg-slate-300 rounded"></div>
            <div class="h-1.5 w-full bg-slate-100 rounded mt-3"></div>
            <div class="h-1.5 w-full bg-slate-100 rounded"></div>
          </div>
          <div class="h-1 w-16 bg-slate-400 rounded"></div>
        </div>
        <p class="text-xs font-medium text-slate-800 mt-2">Project Proposal</p>
      </button>

      <!-- Meeting Notes -->
      <button
        @click="createFromTemplate('notes')"
        class="group text-left"
      >
        <div class="aspect-3/4 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs group-hover:border-indigo-500 transition flex flex-col justify-between">
          <div class="space-y-1.5">
            <div class="h-2 w-14 bg-emerald-600 rounded"></div>
            <div class="h-1 w-18 bg-slate-300 rounded"></div>
            <div class="h-1 w-full bg-slate-200 rounded mt-2"></div>
            <div class="h-1 w-full bg-slate-200 rounded"></div>
            <div class="h-1 w-12 bg-slate-200 rounded"></div>
          </div>
          <div class="h-1 w-14 bg-slate-300 rounded"></div>
        </div>
        <p class="text-xs font-medium text-slate-800 mt-2">Meeting Notes</p>
      </button>

      <!-- Formal Letter -->
      <button
        @click="createFromTemplate('letter')"
        class="group text-left"
      >
        <div class="aspect-3/4 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs group-hover:border-indigo-500 transition flex flex-col justify-between">
          <div class="space-y-1.5">
            <div class="h-1.5 w-8 bg-slate-400 rounded"></div>
            <div class="h-1 w-16 bg-slate-300 rounded"></div>
            <div class="h-1 w-24 bg-slate-200 rounded mt-3"></div>
            <div class="h-1 w-20 bg-slate-200 rounded"></div>
          </div>
          <div class="h-1.5 w-10 bg-slate-800 rounded"></div>
        </div>
        <p class="text-xs font-medium text-slate-800 mt-2">Formal Letter</p>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
const router = useRouter()

function createFromTemplate(templateType: string) {
  const newDocId = `doc-${Date.now()}`
  router.push(`/editor/${newDocId}?template=${templateType}`)
}
</script>
