<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <header class="flex items-center justify-between border-b border-slate-200 pb-6">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white shadow-sm">
          O
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-slate-900">Office Engine</h1>
          <p class="text-xs text-slate-500">Collaborative canvas document suite</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="user">
          <div class="text-right">
            <p class="text-xs font-medium text-slate-700">{{ user.name }}</p>
            <p class="text-[10px] text-slate-400">{{ user.email }}</p>
          </div>
          <div class="flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-xs font-bold text-indigo-700">
            {{ initials }}
          </div>
          <UiButton variant="ghost" size="sm" @click="signOut">Sign out</UiButton>
        </template>
        <UiButton v-else variant="primary" size="sm" @click="goToLogin">
          Sign in
        </UiButton>
      </div>
    </header>

    <DashboardTemplateGallery class="mt-4" @create="handleTemplateCreate" />

    <main class="mt-8">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-800">Recent documents</h2>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-400">Sorted by last modified</span>
          <UiButton variant="primary" size="sm" :loading="creating" @click="createBlank">
            <Plus class="h-3.5 w-3.5" aria-hidden="true" />
            New document
          </UiButton>
        </div>
      </div>

      <p
        v-if="loadError"
        class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
      >
        {{ loadError }}
      </p>

      <div
        v-if="unauthorized"
        class="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"
      >
        <p class="text-sm font-medium text-slate-700">Sign in to see your documents</p>
        <p class="mt-1 text-xs text-slate-400">
          Your work is private to your account until you share it.
        </p>
        <UiButton variant="primary" size="sm" class="mt-4" @click="goToLogin">
          Sign in
        </UiButton>
      </div>

      <div v-else-if="loading" class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
        <div
          v-for="index in 4"
          :key="index"
          class="h-48 animate-pulse rounded-xl border border-slate-200 bg-white"
        />
      </div>

      <div
        v-else-if="documents.length === 0"
        class="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"
      >
        <p class="text-sm font-medium text-slate-700">No documents yet</p>
        <p class="mt-1 text-xs text-slate-400">
          Create a blank document or start from a template.
        </p>
        <UiButton variant="primary" size="sm" class="mt-4" @click="createBlank">
          Create a document
        </UiButton>
      </div>

      <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
        <NuxtLink
          v-for="document in documents"
          :key="document.id"
          :to="`/editor/${document.id}`"
          class="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <div class="mb-3 flex aspect-[4/3] items-center justify-center rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div class="flex h-28 w-20 flex-col space-y-1 rounded border border-slate-200 bg-white p-2 shadow-sm">
              <div class="h-1.5 w-10 rounded bg-slate-300" />
              <div class="h-1 w-14 rounded bg-slate-200" />
              <div class="h-1 w-12 rounded bg-slate-200" />
              <div class="h-1 w-16 rounded bg-slate-200" />
            </div>
          </div>
          <h3 class="truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-600">
            {{ document.title }}
          </h3>
          <div class="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>{{ formatDate(document.updated_at) }}</span>
            <span class="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium uppercase tracking-wide">
              {{ document.kind }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import DashboardTemplateGallery from '~/components/dashboard/TemplateGallery.vue'
import UiButton from '~/components/shared/UiButton.vue'
import {
  createDocument,
  getMe,
  listDocuments,
  logout,
  type DocumentSummary,
  type SessionUser,
} from '~/lib/api/documents'
import { isUnauthorized } from '~/lib/api/client'

const user = ref<SessionUser | null>(null)
const documents = ref<DocumentSummary[]>([])
const loading = ref(true)
const creating = ref(false)
const unauthorized = ref(false)
const loadError = ref('')

const initials = computed(() => {
  const name = user.value?.name?.trim() || user.value?.email || '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
})

onMounted(async () => {
  await loadUser()
  if (!user.value) {
    unauthorized.value = true
    loading.value = false
    return
  }

  await loadDocuments()
  loading.value = false
})

async function loadUser() {
  try {
    const response = await getMe()
    user.value = response.user
    unauthorized.value = false
  } catch (err) {
    if (!isUnauthorized(err)) {
      loadError.value = 'Could not load your account.'
    }
    user.value = null
  }
}

async function loadDocuments() {
  try {
    documents.value = await listDocuments()
  } catch (err) {
    if (isUnauthorized(err)) {
      unauthorized.value = true
      user.value = null
    } else {
      loadError.value = 'Could not load your documents.'
    }
  }
}

async function createBlank() {
  if (!user.value) {
    await navigateTo('/login')
    return
  }

  creating.value = true
  loadError.value = ''
  try {
    const document = await createDocument({ kind: 'doc' })
    await navigateTo(`/editor/${document.id}`)
  } catch {
    loadError.value = 'Could not create a document.'
  } finally {
    creating.value = false
  }
}

async function handleTemplateCreate(template: { id: string; title: string }) {
  if (!user.value) {
    await navigateTo('/login')
    return
  }

  creating.value = true
  loadError.value = ''
  try {
    const document = await createDocument({ kind: 'doc', title: template.title })
    await navigateTo(`/editor/${document.id}?template=${template.id}`)
  } catch {
    loadError.value = 'Could not create a document from this template.'
  } finally {
    creating.value = false
  }
}

function goToLogin() {
  void navigateTo('/login')
}

async function signOut() {
  try {
    await logout()
  } finally {
    user.value = null
    documents.value = []
    unauthorized.value = true
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>
