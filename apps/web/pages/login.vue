<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <div class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
      <div class="mb-6 flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
          O
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight text-slate-900">Office Engine</h1>
          <p class="text-xs text-slate-500">Sign in to continue</p>
        </div>
      </div>

      <a
        v-if="oidcEnabled"
        :href="ssoUrl"
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
      >
        <KeyRound class="h-4 w-4" aria-hidden="true" />
        Continue with SSO
      </a>

      <div
        v-else-if="configLoaded"
        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800"
      >
        SSO is not configured on this deployment. Use the local dev sign-in below.
      </div>

      <template v-if="devAuth">
        <div v-if="oidcEnabled" class="my-6 flex items-center gap-3">
          <span class="h-px flex-1 bg-slate-200" />
          <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">or</span>
          <span class="h-px flex-1 bg-slate-200" />
        </div>

        <UiButton
          :variant="oidcEnabled ? 'secondary' : 'primary'"
          block
          :loading="busy"
          @click="signInWithDev"
        >
          <UserRound class="h-4 w-4" aria-hidden="true" />
          Continue as local dev user
        </UiButton>
        <p class="mt-2 text-center text-[10px] text-slate-400">
          Enabled by <code>DEV_AUTH</code>. Never enable this in production.
        </p>
      </template>

      <p
        v-if="configLoaded && !oidcEnabled && !devAuth"
        class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
      >
        No sign-in method is configured. Set <code>OIDC_ISSUER</code> and client
        credentials, or enable <code>DEV_AUTH</code> for local development.
      </p>

      <p v-if="error" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        {{ error }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { KeyRound, UserRound } from 'lucide-vue-next'
import UiButton from '~/components/shared/UiButton.vue'
import {
  devLogin,
  getAuthConfig,
  getMe,
  type AuthConfig,
} from '~/lib/api/documents'

const config = useRuntimeConfig()
const authConfig = ref<AuthConfig | null>(null)
const configLoaded = ref(false)
const devAuth = computed(
  () => authConfig.value?.dev_auth ?? Boolean(config.public.devAuth),
)
const oidcEnabled = computed(() => authConfig.value?.oidc_enabled ?? false)
const ssoUrl = computed(() => {
  const base = String(config.public.apiBase || '').replace(/\/$/, '')
  return `${base}/api/auth/oidc/start`
})

const busy = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    await getMe()
    await navigateTo('/')
    return
  } catch {
    // Signed out; load the available sign-in methods.
  }

  try {
    authConfig.value = await getAuthConfig()
  } catch {
    // Fall back to the public dev-auth flag.
  } finally {
    configLoaded.value = true
  }
})

async function signInWithDev() {
  busy.value = true
  error.value = ''
  try {
    await devLogin()
    await navigateTo('/')
  } catch {
    error.value = 'Could not start a local dev session. Is DEV_AUTH enabled?'
  } finally {
    busy.value = false
  }
}
</script>
