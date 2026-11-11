import { listMarkers } from './listNumbering'
import { paragraphBlocks } from './paragraphs'

export type ParagraphStyle = 'normal' | 'h1' | 'h2' | 'h3'
export type ListType = 'ul' | 'ol'
export type Alignment = 'left' | 'center' | 'right'

export interface TextStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  paragraph?: ParagraphStyle
  list?: ListType
  listLevel?: number
  align?: Alignment
}

export interface StyledChar {
  char: string
  style: TextStyle
}

export interface LineBox {
  chars: StyledChar[]
  /** x offset before each char, plus the total line width at `chars.length`. */
  xs: number[]
  start: number
  end: number
  /** Absolute y within the stacked page canvas. */
  y: number
  /** Height of this line, which varies for headings. */
  height: number
  page: number
  /** Text start relative to the content margin. */
  left: number
  /** Width of the visible text, excluding a list marker. */
  width: number
  /** Block style shared by every character in the paragraph. */
  style: TextStyle
  prefix?: string
  /** Marker start relative to the content margin. */
  prefixX?: number
}

export interface PageLayout {
  pageHeight: number
  marginTop: number
  marginBottom: number
  pageGap: number
}

export interface CaretRect {
  x: number
  y: number
  height: number
}

export const DOC_FONT_FAMILY =
  '"Helvetica Neue", Arial, "Noto Sans CJK SC", "Noto Sans", sans-serif'

/** Horizontal indent for each nested list level. */
export const LIST_INDENT_WIDTH = 30
/** Gap between a list marker and its text. */
export const LIST_MARKER_GAP = 10

/** Font size for a paragraph style. */
export function fontSizeForStyle(style: TextStyle): number {
  switch (style.paragraph) {
    case 'h1':
      return 32
    case 'h2':
      return 24
    case 'h3':
      return 20
    default:
      return 16
  }
}

/** Line height for a paragraph style. */
export function lineHeightForStyle(style: TextStyle): number {
  switch (style.paragraph) {
    case 'h1':
      return 44
    case 'h2':
      return 34
    case 'h3':
      return 28
    default:
      return 24
  }
}

/** Build a canvas font string for a rich-text style. */
export function fontForStyle(
  style: TextStyle,
  size = fontSizeForStyle(style),
): string {
  const parts: string[] = []
  if (style.italic) parts.push('italic')
  if (style.bold || (style.paragraph && style.paragraph !== 'normal')) {
    parts.push('bold')
  }
  parts.push(`${size}px`, DOC_FONT_FAMILY)
  return parts.join(' ')
}

/** Measure a sequence of styled characters. */
export function measureStyledChars(
  ctx: CanvasRenderingContext2D,
  chars: StyledChar[],
): number {
  let width = 0
  for (const item of chars) {
    ctx.font = fontForStyle(item.style)
    width += ctx.measureText(item.char).width
  }
  return width
}

/**
 * Wrap paragraph blocks into visual lines.
 *
 * List indentation and aligned-line offsets follow canvas-editor's
 * LayoutEngine/Position geometry (MIT), reimplemented for our line model.
 * Positions are measured in Unicode code points (what Loro uses), not UTF-16
 * code units, so emoji and other non-BMP characters stay aligned. List markers
 * and alignment offsets are resolved here so caret placement and hit-testing
 * share exactly the same geometry as rendering.
 */
export function layoutChars(
  ctx: CanvasRenderingContext2D,
  chars: StyledChar[],
  maxWidth: number,
  lineHeight: number,
  top: number,
  page?: PageLayout,
): LineBox[] {
  const lines: LineBox[] = []
  const blocks = paragraphBlocks(chars)
  const markers = listMarkers(blocks)
  const stride = page ? page.pageHeight + page.pageGap : 0
  let pageIndex = 0
  let y = top

  const pageBottom = () =>
    page ? pageIndex * stride + page.pageHeight - page.marginBottom : 0

  const ensureSpace = (height: number) => {
    if (!page) return
    if (y + height > pageBottom()) {
      pageIndex += 1
      y = pageIndex * stride + page.marginTop
    }
  }

  blocks.forEach((block, blockIndex) => {
    const marker = markers[blockIndex]
    const level = marker?.level ?? 0
    const indent = marker ? level * LIST_INDENT_WIDTH : 0
    const height = lineHeightForStyle(block.style)
    let prefixReserve = 0

    if (marker) {
      ctx.font = fontForStyle(block.style)
      prefixReserve = ctx.measureText(marker.prefix).width + LIST_MARKER_GAP
    }

    const textMaxWidth = Math.max(12, maxWidth - indent - prefixReserve)
    let lineChars: StyledChar[] = []
    let lineXs: number[] = [0]
    let lineStart = block.start
    let lineWidth = 0
    let firstLine = true

    const pushLine = () => {
      const contentWidth = prefixReserve + lineWidth
      const available = Math.max(0, maxWidth - indent)
      let offset = 0
      if (block.style.align === 'center') {
        offset = (available - contentWidth) / 2
      } else if (block.style.align === 'right') {
        offset = available - contentWidth
      }
      offset = Math.max(0, offset)

      const prefixX = indent + offset
      const textLeft = prefixX + prefixReserve
      ensureSpace(height)
      lines.push({
        chars: lineChars,
        xs: lineXs,
        start: lineStart,
        end: lineStart + lineChars.length,
        y,
        height,
        page: pageIndex,
        left: textLeft,
        width: lineWidth,
        style: block.style,
        prefix: firstLine && marker ? marker.prefix : undefined,
        prefixX: firstLine && marker ? prefixX : undefined,
      })
      y += height
      firstLine = false
      lineChars = []
      lineXs = [0]
      lineWidth = 0
    }

    for (let index = block.start; index < block.end; index += 1) {
      const item = chars[index]
      ctx.font = fontForStyle({
        ...item.style,
        paragraph: block.style.paragraph,
      })
      const charWidth = ctx.measureText(item.char).width

      if (lineWidth + charWidth > textMaxWidth && lineChars.length > 0) {
        pushLine()
        lineStart = index
      }

      lineChars.push(item)
      lineXs.push(lineXs[lineXs.length - 1] + charWidth)
      lineWidth += charWidth
    }

    pushLine()
  })

  return lines
}

export function caretRect(
  _ctx: CanvasRenderingContext2D,
  lines: LineBox[],
  index: number,
  left: number,
): CaretRect {
  const line = lineForIndex(lines, index)
  const offset = Math.min(Math.max(index - line.start, 0), line.chars.length)

  return {
    x: left + line.left + (line.xs[offset] ?? 0),
    y: line.y,
    height: line.height,
  }
}

export function hitTestChar(
  _ctx: CanvasRenderingContext2D,
  lines: LineBox[],
  x: number,
  y: number,
  left: number,
): number {
  const line = lineForY(lines, y)
  const contentX = x - left - line.left

  if (contentX <= 0 || line.chars.length === 0) {
    return line.start
  }

  for (let offset = 0; offset < line.chars.length; offset++) {
    const start = line.xs[offset] ?? 0
    const end = line.xs[offset + 1] ?? start
    if (contentX < start + (end - start) / 2) {
      return line.start + offset
    }
  }

  return line.end
}

export function lineForIndex(lines: LineBox[], index: number): LineBox {
  return (
    lines.find((line) => index >= line.start && index < line.end) ??
    lines.find((line) => index === line.end) ??
    (index < lines[0]?.start ? lines[0] : lines[lines.length - 1])
  )
}

function lineForY(lines: LineBox[], y: number): LineBox {
  return (
    lines.find((line) => y >= line.y && y < line.y + line.height) ??
    (y < lines[0].y ? lines[0] : lines[lines.length - 1])
  )
}
