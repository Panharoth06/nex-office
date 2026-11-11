import { blockAt, blocksInRange, paragraphBlocks } from './paragraphs'
import type {
  Alignment,
  ListType,
  ParagraphStyle,
  StyledChar,
  TextStyle,
} from './textLayout'

export type { Alignment, ListType, ParagraphStyle }

export interface TextDeltaSegment {
  insert?: string
  retain?: number
  delete?: number
  attributes?: Record<string, unknown> | null
}

export interface FormatState {
  bold: boolean
  italic: boolean
  underline: boolean
  paragraph: ParagraphStyle
  list: ListType | null
  listLevel: number
  align: Alignment
}

export type FormatKey = 'bold' | 'italic' | 'underline'

export const EMPTY_FORMAT_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  paragraph: 'normal',
  list: null,
  listLevel: 0,
  align: 'left',
}

export function paragraphStyleFromAttributes(
  attributes?: Record<string, unknown> | null,
): ParagraphStyle {
  const value = attributes?.paragraph
  return value === 'h1' || value === 'h2' || value === 'h3' ? value : 'normal'
}

export function listTypeFromAttributes(
  attributes?: Record<string, unknown> | null,
): ListType | null {
  const value = attributes?.list
  return value === 'ul' || value === 'ol' ? value : null
}

export function listLevelFromAttributes(
  attributes?: Record<string, unknown> | null,
): number {
  const raw = attributes?.list_level
  const value =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(8, Math.floor(value)))
}

export function alignmentFromAttributes(
  attributes?: Record<string, unknown> | null,
): Alignment {
  const value = attributes?.align
  return value === 'center' || value === 'right' ? value : 'left'
}

export function styleFromAttributes(
  attributes?: Record<string, unknown> | null,
): TextStyle {
  const paragraph = attributes?.paragraph
  const list = attributes?.list
  const listLevel = attributes?.list_level
  const align = attributes?.align

  return {
    bold: attributes?.bold === true,
    italic: attributes?.italic === true,
    underline: attributes?.underline === true,
    paragraph:
      paragraph === 'normal' || paragraph === 'h1' || paragraph === 'h2' || paragraph === 'h3'
        ? paragraph
        : undefined,
    list: list === 'ul' || list === 'ol' ? list : undefined,
    listLevel:
      typeof listLevel === 'number' || typeof listLevel === 'string'
        ? listLevelFromAttributes(attributes)
        : undefined,
    align:
      align === 'left' || align === 'center' || align === 'right'
        ? align
        : undefined,
  }
}

/** Flatten a Loro rich-text delta into one entry per Unicode code point. */
export function styledCharsFromDelta(delta: TextDeltaSegment[]): StyledChar[] {
  const chars: StyledChar[] = []

  for (const segment of delta) {
    if (typeof segment.insert !== 'string') continue
    const style = styleFromAttributes(segment.attributes)
    for (const char of Array.from(segment.insert)) {
      chars.push({ char, style })
    }
  }

  return chars
}

/** Attributes active at a caret position. */
export function attributesAt(
  delta: TextDeltaSegment[],
  index: number,
): Record<string, unknown> {
  let offset = 0

  for (const segment of delta) {
    const text = typeof segment.insert === 'string' ? segment.insert : ''
    const length = Array.from(text).length
    if (index < offset + length) return segment.attributes ?? {}
    offset += length
  }

  return {}
}

/**
 * Formatting state at a collapsed caret.
 *
 * Inline marks come from the character at the caret (falling back to the
 * previous character at a paragraph end). Block marks come from the paragraph
 * block, which also covers empty list items via their leading newline.
 */
export function formatStateAtCaret(
  delta: TextDeltaSegment[],
  index: number,
): FormatState {
  const chars = styledCharsFromDelta(delta)
  if (chars.length === 0) return { ...EMPTY_FORMAT_STATE }

  const blocks = paragraphBlocks(chars)
  const block = blockAt(blocks, index)
  const inline = chars[index]?.style ?? chars[index - 1]?.style ?? {}

  return {
    bold: inline.bold === true,
    italic: inline.italic === true,
    underline: inline.underline === true,
    paragraph: block.style.paragraph ?? 'normal',
    list: block.style.list ?? null,
    listLevel: block.style.listLevel ?? 0,
    align: block.style.align ?? 'left',
  }
}

/** Marks common to an entire selection, or active at a collapsed caret. */
export function formatStateForRange(
  delta: TextDeltaSegment[],
  start: number,
  end: number,
): FormatState {
  if (end <= start) return formatStateAtCaret(delta, start)

  const chars = styledCharsFromDelta(delta)
  if (chars.length === 0) return { ...EMPTY_FORMAT_STATE }

  const selected = chars.slice(start, end)
  if (selected.length === 0) return { ...EMPTY_FORMAT_STATE }

  const blocks = blocksInRange(paragraphBlocks(chars), start, end)
  const paragraph = blocks[0]?.style.paragraph ?? 'normal'
  const list = blocks[0]?.style.list ?? null
  const listLevel = blocks[0]?.style.listLevel ?? 0
  const align = blocks[0]?.style.align ?? 'left'

  return {
    bold: selected.every((item) => item.style.bold),
    italic: selected.every((item) => item.style.italic),
    underline: selected.every((item) => item.style.underline),
    paragraph: blocks.every((block) => block.style.paragraph === paragraph)
      ? paragraph
      : 'normal',
    list: blocks.every((block) => (block.style.list ?? null) === list)
      ? list
      : null,
    listLevel: blocks.every((block) => (block.style.listLevel ?? 0) === listLevel)
      ? listLevel
      : 0,
    align: blocks.every((block) => (block.style.align ?? 'left') === align)
      ? align
      : 'left',
  }
}
