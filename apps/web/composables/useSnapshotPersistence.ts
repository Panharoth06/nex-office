import { computed, ref } from 'vue'
import { getSnapshot, saveSnapshot } from '~/lib/api/documents'

export interface SnapshotEngine {
  exportSnapshot(): Uint8Array
}

/**
 * Debounced snapshot persistence for the canvas editor.
 *
 * Loading is explicit so the caller can import the snapshot into the Wasm
 * engine before marking the document ready. Saving is debounced and flushed on
 * unmount.
 */
export function useSnapshotPersistence(
  docId: string,
  engine: () => SnapshotEngine | null,
  isReady: () => boolean,
) {
  const saveState = ref<'saving' | 'saved' | 'error'>('saved')
  let saveTimer: number | undefined
  let dirty = false

  const label = computed(() => {
    if (saveState.value === 'saving') return 'Saving…'
    if (saveState.value === 'error') return 'Could not save — edit again to retry'
    return 'All changes saved'
  })

  async function load(): Promise<Uint8Array | null> {
    return getSnapshot(docId)
  }

  function markLoaded() {
    dirty = false
    saveState.value = 'saved'
  }

  function schedule() {
    if (!isReady() || !engine()) return

    dirty = true
    saveState.value = 'saving'
    if (saveTimer !== undefined) {
      window.clearTimeout(saveTimer)
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined
      void flush()
    }, 800)
  }

  async function flush() {
    const current = engine()
    if (!current || !isReady() || !dirty) return

    saveState.value = 'saving'
    try {
      await saveSnapshot(docId, current.exportSnapshot())
      dirty = false
      saveState.value = 'saved'
    } catch (error) {
      saveState.value = 'error'
      console.warn('[editor] snapshot save failed', error)
    }
  }

  function dispose() {
    if (saveTimer !== undefined) {
      window.clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (dirty && engine() && isReady()) {
      void flush()
    }
  }

  return { saveState, label, load, markLoaded, schedule, flush, dispose }
}
