import type { ParagraphBlock } from './paragraphs'
import type { ListType } from './textLayout'

export interface ListMarker {
  type: ListType
  level: number
  prefix: string
}

const MAX_LIST_LEVEL = 8
const BULLETS = ['•', '◦', '▪'] as const

/**
 * Derive list markers from adjacent paragraph blocks.
 *
 * Behaviour follows canvas-editor's ListParticle (MIT), adapted to our
 * mark-based paragraph model. Numbering is not stored in the CRDT. It is
 * recomputed from contiguous list runs so edits, splits, and merges always
 * produce deterministic markers. A non-list paragraph or a list-type change
 * resets numbering.
 */
export function listMarkers(blocks: ParagraphBlock[]): Array<ListMarker | null> {
  const counters = Array.from({ length: MAX_LIST_LEVEL + 1 }, () => 0)
  const activeTypes: Array<ListType | null> = Array.from(
    { length: MAX_LIST_LEVEL + 1 },
    () => null,
  )
  let previousWasList = false
  const markers: Array<ListMarker | null> = []

  for (const block of blocks) {
    const type = block.style.list
    if (!type) {
      counters.fill(0)
      activeTypes.fill(null)
      previousWasList = false
      markers.push(null)
      continue
    }

    const level = Math.max(
      0,
      Math.min(MAX_LIST_LEVEL, Math.floor(block.style.listLevel ?? 0)),
    )

    if (!previousWasList) {
      counters.fill(0)
      activeTypes.fill(null)
    }
    if (activeTypes[level] !== type) counters[level] = 0

    for (let deeper = level + 1; deeper <= MAX_LIST_LEVEL; deeper += 1) {
      counters[deeper] = 0
      activeTypes[deeper] = null
    }
    activeTypes[level] = type
    previousWasList = true

    if (type === 'ol') {
      counters[level] += 1
      markers.push({ type, level, prefix: `${counters[level]}.` })
    } else {
      markers.push({
        type,
        level,
        prefix: BULLETS[level % BULLETS.length],
      })
    }
  }

  return markers
}

/** Bullet glyph for an unordered-list level. */
export function bulletForLevel(level: number): string {
  return BULLETS[level % BULLETS.length]
}
