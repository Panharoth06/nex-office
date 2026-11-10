<template>
  <div class="max-w-6xl mx-auto py-12 px-6">
    <header class="flex items-center justify-between pb-8 border-b border-slate-200">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">Office Engine</h1>
        <p class="text-sm text-slate-500 mt-1">Google Docs-caliber canvas-rendered document workspace</p>
      </div>
      <NuxtLink
        to="/editor/demo-doc"
        class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition"
      >
        <span>+ New Document</span>
      </NuxtLink>
    </header>

    <main class="mt-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NuxtLink
          to="/editor/demo-doc"
          class="group block p-6 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-indigo-500 hover:shadow-md transition"
        >
          <div class="h-40 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center p-4 mb-4">
            <div class="w-24 h-32 bg-white shadow-xs border border-slate-200 rounded flex flex-col p-2 space-y-1.5">
              <div class="h-2 w-12 bg-slate-300 rounded"></div>
              <div class="h-1.5 w-16 bg-slate-200 rounded"></div>
              <div class="h-1.5 w-14 bg-slate-200 rounded"></div>
              <div class="h-1.5 w-18 bg-slate-200 rounded"></div>
            </div>
          </div>
          <h2 class="text-base font-semibold text-slate-900 group-hover:text-indigo-600">Sample Specification Document</h2>
          <p class="text-xs text-slate-500 mt-1">Edited 2 hours ago • A4 Multi-page</p>
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
