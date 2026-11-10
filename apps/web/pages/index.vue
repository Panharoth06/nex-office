<template>
  <div class="max-w-6xl mx-auto py-8 px-6">
    <!-- Application Brand & Navigation -->
    <header class="flex items-center justify-between pb-6 border-b border-slate-200">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
          O
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-slate-900">Office Engine</h1>
          <p class="text-xs text-slate-500">Collaborative canvas document suite</p>
        </div>
      </div>

      <!-- User Account Menu -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-600 font-medium">John Doe (Personal Workspace)</span>
        <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs border border-indigo-200">
          JD
        </div>
      </div>
    </header>

    <!-- Google Docs-Style Template Gallery -->
    <DashboardTemplateGallery class="mt-4" />

    <!-- Recent Documents List -->
    <main class="mt-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-800">Recent documents</h2>
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <span>Sort by last opened</span>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
        <NuxtLink
          to="/editor/demo-doc"
          class="group block p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-indigo-500 hover:shadow-md transition"
        >
          <div class="aspect-4/3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center p-3 mb-3">
            <div class="w-20 h-28 bg-white shadow-2xs border border-slate-200 rounded flex flex-col p-2 space-y-1">
              <div class="h-1.5 w-10 bg-slate-300 rounded"></div>
              <div class="h-1 w-14 bg-slate-200 rounded"></div>
              <div class="h-1 w-12 bg-slate-200 rounded"></div>
              <div class="h-1 w-16 bg-slate-200 rounded"></div>
            </div>
          </div>
          <h3 class="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 truncate">Quarterly Strategy Memo</h3>
          <div class="flex items-center justify-between text-2xs text-slate-400 mt-1">
            <span>Opened 2 hours ago</span>
            <span>Shared (Editor)</span>
          </div>
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import DashboardTemplateGallery from '~/components/dashboard/TemplateGallery.vue'
</script>
