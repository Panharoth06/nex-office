import { styledCharsFromHtml } from './clipboardHtml'
import {
  styledCharsFromDelta,
  styleFromAttributes,
  type TextDeltaSegment,
} from './richText'
import type { StyledChar, TextStyle } from './textLayout'

export const CLIPBOARD_MIME = 'application/x-nex-office-fragment'

export interface ClipboardPayload {
  text: string
  html: string
  custom: string
}

export type ClipboardRead =
  | { kind: 'rich'; chars: StyledChar[] }
  | { kind: 'plain'; text: string }
  | null

interface SerializedChar {
  c: string
  a: Record<string, string | boolean>
}

/** Serialize selected characters into plain, HTML, and internal fragments. */
export function clipboardPayloadFromChars(chars: StyledChar[]): ClipboardPayload {
  const text = chars.map((item) => item.char).join('')
  const custom = JSON.stringify({
    version: 1,
    chars: chars.map<SerializedChar>((item) => ({
      c: item.char,
      a: attributesFromStyle(item.style),
    })),
  })

  return { text, html: charsToHtml(chars), custom }
}

/** Write a rich selection into a clipboard event. */
export function writeClipboard(data: DataTransfer, chars: StyledChar[]): void {
  const payload = clipboardPayloadFromChars(chars)
  data.setData('text/plain', payload.text)
  data.setData('text/html', payload.html)
  data.setData(CLIPBOARD_MIME, payload.custom)
}

/** Read a rich fragment, HTML, or plain text from a clipboard event. */
export function readClipboard(data: DataTransfer): ClipboardRead {
  const custom = parseCustomFragment(data.getData(CLIPBOARD_MIME))
  if (custom && custom.length > 0) return { kind: 'rich', chars: custom }

  const html = data.getData('text/html')
  if (html) {
    const chars = styledCharsFromHtml(html)
    if (chars.length > 0) return { kind: 'rich', chars }
  }

  const text = data.getData('text/plain')
  if (text) return { kind: 'plain', text }
  return null
}

export function attributesFromStyle(
  style: TextStyle,
): Record<string, string | boolean> {
  const attributes: Record<string, string | boolean> = {}
  if (style.bold) attributes.bold = true
  if (style.italic) attributes.italic = true
  if (style.underline) attributes.underline = true
  if (style.paragraph && style.paragraph !== 'normal') {
    attributes.paragraph = style.paragraph
  }
  if (style.list) {
    attributes.list = style.list
    attributes.list_level = String(style.listLevel ?? 0)
  }
  if (style.align && style.align !== 'left') attributes.align = style.align
  return attributes
}

function parseCustomFragment(value: string): StyledChar[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as {
      version?: number
      chars?: SerializedChar[]
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.chars)) return null
    return parsed.chars
      .filter((item) => typeof item.c === 'string')
      .map((item) => ({
        char: item.c,
        style: styleFromAttributes(item.a),
      }))
  } catch {
    return null
  }
}

function charsToHtml(chars: StyledChar[]): string {
  if (chars.length === 0) return ''

  const paragraphs: StyledChar[][] = []
  let current: StyledChar[] = []
  for (const item of chars) {
    if (item.char === '\n') {
      paragraphs.push(current)
      current = []
    } else {
      current.push(item)
    }
  }
  paragraphs.push(current)

  return paragraphs
    .map((paragraph) => {
      const style = paragraph[0]?.style ?? {}
      const inner = inlineHtml(paragraph)
      const css = ['white-space:pre-wrap']
      if (style.align === 'center') css.push('text-align:center')
      if (style.align === 'right') css.push('text-align:right')
      const content = inner || '<br>'

      if (style.list) {
        const tag = style.list === 'ol' ? 'ol' : 'ul'
        const indent = (style.listLevel ?? 0) * 24
        return `<${tag}><li style="${css.join(';')};${
          indent ? `margin-left:${indent}px` : ''
        }">${content}</li></${tag}>`
      }

      const tag =
        style.paragraph === 'h1'
          ? 'h1'
          : style.paragraph === 'h2'
            ? 'h2'
            : style.paragraph === 'h3'
              ? 'h3'
              : 'p'
      return `<${tag} style="${css.join(';')}">${content}</${tag}>`
    })
    .join('')
}

function inlineHtml(chars: StyledChar[]): string {
  let html = ''
  let start = 0
  while (start < chars.length) {
    const style = chars[start].style
    let end = start + 1
    while (
      end < chars.length &&
      chars[end].style.bold === style.bold &&
      chars[end].style.italic === style.italic &&
      chars[end].style.underline === style.underline
    ) {
      end += 1
    }
    let text = escapeHtml(
      chars
        .slice(start, end)
        .map((item) => item.char)
        .join(''),
    )
    if (style.underline) text = `<u>${text}</u>`
    if (style.italic) text = `<em>${text}</em>`
    if (style.bold) text = `<strong>${text}</strong>`
    html += text
    start = end
  }
  return html
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Flatten a delta and slice a clipboard range in Unicode code points. */
export function charsFromDelta(
  delta: TextDeltaSegment[],
  start: number,
  end: number,
): StyledChar[] {
  return styledCharsFromDelta(delta).slice(start, end)
}
