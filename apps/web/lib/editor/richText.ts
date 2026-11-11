import type { StyledChar, TextStyle } from './textLayout'

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
}

export type FormatKey = keyof FormatState

export const EMPTY_FORMAT_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
}

export function styleFromAttributes(
  attributes?: Record<string, unknown> | null,
): TextStyle {
  return {
    bold: attributes?.bold === true,
    italic: attributes?.italic === true,
    underline: attributes?.underline === true,
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

/** Marks common to an entire selection, or active at a collapsed caret. */
export function formatStateForRange(
  delta: TextDeltaSegment[],
  start: number,
  end: number,
): FormatState {
  if (end <= start) {
    return styleToFormatState(styleFromAttributes(attributesAt(delta, start)))
  }

  const chars = styledCharsFromDelta(delta).slice(start, end)
  if (chars.length === 0) return { ...EMPTY_FORMAT_STATE }

  return {
    bold: chars.every((item) => item.style.bold),
    italic: chars.every((item) => item.style.italic),
    underline: chars.every((item) => item.style.underline),
  }
}

function styleToFormatState(style: TextStyle): FormatState {
  return {
    bold: style.bold === true,
    italic: style.italic === true,
    underline: style.underline === true,
  }
}
