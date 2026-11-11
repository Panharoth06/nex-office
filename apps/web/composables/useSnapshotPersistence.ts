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
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  let editRevision = 0
  let flushChain = Promise.resolve()

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
    editRevision = 0
    saveState.value = 'saved'
  }

  function schedule() {
    if (!isReady() || !engine()) return

    dirty = true
    editRevision += 1
    saveState.value = 'saving'
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void flush()
    }, 800)
  }

  async function flush() {
    flushChain = flushChain.then(savePending)
    return flushChain
  }

  async function savePending() {
    const current = engine()
    if (!current || !isReady() || !dirty) return

    const revision = editRevision
    saveState.value = 'saving'
    try {
      const snapshot = current.exportSnapshot()
      await saveSnapshot(docId, snapshot)
      if (editRevision === revision) {
        dirty = false
        saveState.value = 'saved'
      } else {
        // An edit landed while this snapshot was in flight. The newer debounce
        // timer will save again; keep the state dirty until it succeeds.
        dirty = true
        saveState.value = 'saving'
      }
    } catch (error) {
      dirty = true
      saveState.value = 'error'
      console.warn('[editor] snapshot save failed', error)
    }
  }

  function dispose() {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (dirty && engine() && isReady()) {
      void flush()
    }
  }

  return { saveState, label, load, markLoaded, schedule, flush, dispose }
}
