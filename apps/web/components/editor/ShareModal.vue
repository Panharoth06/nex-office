<template>
  <UiModal :open="isOpen" :labelled-by="titleId" @close="$emit('close')">
    <div class="p-6">
      <div class="flex items-center justify-between border-b border-slate-100 pb-4">
        <h3 :id="titleId" class="text-base font-semibold text-slate-900">
          Share “{{ documentTitle }}”
        </h3>
        <UiButton variant="ghost" size="icon" aria-label="Close share dialog" @click="$emit('close')">
          <X class="h-4 w-4" aria-hidden="true" />
        </UiButton>
      </div>

      <div class="mt-4">
        <label :for="emailId" class="mb-1 block text-xs font-medium text-slate-700">
          Add people, groups, or emails
        </label>
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <UiTextField
              :id="emailId"
              v-model="inviteEmail"
              type="email"
              placeholder="colleague@company.com"
              :invalid="Boolean(emailError)"
              :aria-describedby="emailError ? emailErrorId : undefined"
              @keydown.enter="sendInvite"
            />
            <p v-if="emailError" :id="emailErrorId" class="mt-1 text-[10px] text-rose-600">
              {{ emailError }}
            </p>
          </div>
          <UiSelect
            v-model="inviteRole"
            :options="roleOptions"
            variant="ghost"
            menu-align="end"
            aria-label="Invite role"
          />
          <UiButton variant="primary" size="sm" @click="sendInvite">
            <Send class="h-3 w-3" aria-hidden="true" />
            Send
          </UiButton>
        </div>
        <p class="mt-1 text-[10px] text-slate-400">
          Invitations are UI-only until document permissions land in M2.
        </p>
      </div>

      <div class="mt-5 space-y-3">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          People with access
        </div>
        <div class="flex items-center justify-between py-1 text-xs">
          <div class="flex items-center gap-2.5">
            <div class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              JD
            </div>
            <div>
              <p class="font-medium text-slate-800">John Doe</p>
              <p class="text-slate-400">john@example.com</p>
            </div>
          </div>
          <span class="font-medium text-slate-500">Owner</span>
        </div>
      </div>

      <div class="mt-6 border-t border-slate-100 pt-5">
        <div class="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          General access
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Lock v-if="accessType === 'restricted'" class="h-4 w-4" aria-hidden="true" />
              <Globe2 v-else class="h-4 w-4" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <UiSelect
                v-model="accessType"
                :options="accessOptions"
                variant="inline"
                aria-label="General access"
              />
              <p class="mt-0.5 text-[10px] text-slate-400">
                {{
                  accessType === 'restricted'
                    ? 'Only people with access can open with the link'
                    : 'Anyone on the internet with the link can access'
                }}
              </p>
            </div>
          </div>

          <UiSelect
            v-if="accessType === 'anyone'"
            v-model="publicRole"
            :options="publicRoleOptions"
            variant="ghost"
            menu-align="end"
            aria-label="Public link role"
          />
        </div>
      </div>

      <div
        v-if="copyError"
        class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-2.5"
      >
        <p class="text-[10px] font-medium text-amber-800">
          Clipboard access was blocked. Copy the link manually:
        </p>
        <UiTextField
          :model-value="shareUrl"
          readonly
          variant="field"
          class="mt-1.5"
          aria-label="Share link"
          @focus="$event.target instanceof HTMLInputElement && $event.target.select()"
        />
      </div>

      <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <UiButton variant="secondary" size="sm" @click="copyLink">
          <Check v-if="copied" class="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <Link2 v-else class="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-live="polite">{{ copied ? 'Link copied' : 'Copy link' }}</span>
        </UiButton>
        <UiButton variant="primary" size="sm" @click="$emit('close')">Done</UiButton>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Check, Globe2, Link2, Lock, Send, X } from 'lucide-vue-next'
import UiButton from '~/components/shared/UiButton.vue'
import UiModal from '~/components/shared/UiModal.vue'
import UiSelect from '~/components/shared/UiSelect.vue'
import UiTextField from '~/components/shared/UiTextField.vue'

const props = defineProps<{
  isOpen: boolean
  documentTitle: string
  docId: string
}>()

defineEmits<{
  (e: 'close'): void
}>()

const inviteEmail = ref('')
const inviteRole = ref<'viewer' | 'commenter' | 'editor'>('editor')
const accessType = ref<'restricted' | 'anyone'>('restricted')
const publicRole = ref<'public_view' | 'public_comment' | 'public_edit'>('public_view')
const copied = ref(false)
const copyError = ref(false)
const emailError = ref('')

const titleId = `share-title-${useId()}`
const emailId = `share-email-${useId()}`
const emailErrorId = `share-email-error-${useId()}`

const shareUrl = computed(() =>
  typeof window === 'undefined' ? '' : `${window.location.origin}/editor/${props.docId}`,
)

const roleOptions = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'commenter', label: 'Commenter' },
  { value: 'editor', label: 'Editor' },
] as const

const accessOptions = [
  { value: 'restricted', label: 'Restricted' },
  { value: 'anyone', label: 'Anyone with the link' },
] as const

const publicRoleOptions = [
  { value: 'public_view', label: 'Viewer' },
  { value: 'public_comment', label: 'Commenter' },
  { value: 'public_edit', label: 'Editor' },
] as const

function sendInvite() {
  const email = inviteEmail.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailError.value = 'Enter a valid email address.'
    return
  }

  emailError.value = ''
  console.debug('[share] invite', { email, role: inviteRole.value })
  inviteEmail.value = ''
}

async function copyLink() {
  copyError.value = false
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    copyError.value = true
  }
}
</script>
