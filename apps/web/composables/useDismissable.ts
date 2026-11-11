import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * Close a popover when the user clicks outside its root or presses Escape.
 *
 * The listener is registered only while the popover is open so closed
 * instances never intercept global pointer events.
 */
export function useDismissable(
  root: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  close: () => void,
  onEscape: () => void = close,
): void {
  function onPointerDown(event: PointerEvent) {
    if (!open.value) return
    const target = event.target
    if (root.value && target instanceof Node && !root.value.contains(target)) {
      close()
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (open.value && event.key === 'Escape') {
      onEscape()
    }
  }

  function attach() {
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeydown, true)
  }

  function detach() {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeydown, true)
  }

  watch(open, (value) => {
    if (value) attach()
    else detach()
  })

  onBeforeUnmount(detach)
}
