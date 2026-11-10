<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-100">
      <!-- Modal Header -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-100">
        <h3 class="text-base font-semibold text-slate-900">Share "{{ documentTitle }}"</h3>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
      </div>

      <!-- Section 1: Add People & Groups -->
      <div class="mt-4">
        <label class="block text-xs font-medium text-slate-700 mb-1">Add people, groups, or emails</label>
        <div class="flex gap-2">
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="colleague@company.com"
            class="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-indigo-500"
          />
          <select
            v-model="inviteRole"
            class="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="viewer">Viewer</option>
            <option value="commenter">Commenter</option>
            <option value="editor">Editor</option>
          </select>
          <button
            @click="sendInvite"
            class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition"
          >
            Send
          </button>
        </div>
      </div>

      <!-- People with access list -->
      <div class="mt-5 space-y-3">
        <div class="text-xs font-medium text-slate-500 uppercase tracking-wider">People with access</div>
        <div class="flex items-center justify-between text-xs py-1">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
              JD
            </div>
            <div>
              <p class="font-medium text-slate-800">You (John Doe)</p>
              <p class="text-slate-400">john@example.com</p>
            </div>
          </div>
          <span class="text-slate-500 font-medium">Owner</span>
        </div>
      </div>

      <!-- Section 2: General Access (Link Sharing) -->
      <div class="mt-6 pt-5 border-t border-slate-100">
        <div class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">General access</div>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-sm">
              🔗
            </div>
            <div>
              <select
                v-model="accessType"
                class="text-xs font-semibold text-slate-800 border-none bg-transparent p-0 focus:outline-hidden cursor-pointer"
              >
                <option value="restricted">Restricted</option>
                <option value="anyone">Anyone with the link</option>
              </select>
              <p class="text-2xs text-slate-400 mt-0.5">
                {{ accessType === 'restricted' ? 'Only people with access can open with the link' : 'Anyone on the internet with the link can access' }}
              </p>
            </div>
          </div>

          <select
            v-if="accessType === 'anyone'"
            v-model="publicRole"
            class="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="public_view">Viewer</option>
            <option value="public_comment">Commenter</option>
            <option value="public_edit">Editor</option>
          </select>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
        <button
          @click="copyLink"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition"
        >
          <span>{{ copied ? '✓ Link copied!' : '📋 Copy link' }}</span>
        </button>
        <button
          @click="$emit('close')"
          class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-lg transition"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

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

function sendInvite() {
  if (!inviteEmail.value) return
  console.log('[Share] Invited:', inviteEmail.value, inviteRole.value)
  inviteEmail.value = ''
}

function copyLink() {
  const url = `${window.location.origin}/editor/${props.docId}`
  navigator.clipboard.writeText(url)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>
