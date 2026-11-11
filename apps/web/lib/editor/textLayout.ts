export interface TextStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
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
  page: number
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

/** Build a canvas font string for a rich-text style. */
export function fontForStyle(style: TextStyle, size = 16): string {
  const parts: string[] = []
  if (style.italic) parts.push('italic')
  if (style.bold) parts.push('bold')
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
 * Wrap styled Unicode code points into visual lines.
 *
 * Positions are measured in Unicode code points (what Loro uses), not UTF-16
 * code units, so emoji and other non-BMP characters stay aligned.
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
  let lineChars: StyledChar[] = []
  let lineXs: number[] = [0]
  let lineStart = 0
  let width = 0
  let pageIndex = 0
  let y = top
  const stride = page ? page.pageHeight + page.pageGap : 0

  const pushLine = () => {
    lines.push({
      chars: lineChars,
      xs: lineXs,
      start: lineStart,
      end: lineStart + lineChars.length,
      y,
      page: pageIndex,
    })
    y += lineHeight
    lineChars = []
    lineXs = [0]
    width = 0
    ensureSpace()
  }

  const ensureSpace = () => {
    if (!page) return
    const bottom = pageIndex * stride + page.pageHeight - page.marginBottom
    if (y + lineHeight > bottom) {
      pageIndex += 1
      y = pageIndex * stride + page.marginTop
    }
  }

  for (let index = 0; index < chars.length; index++) {
    const item = chars[index]

    if (item.char === '\n') {
      pushLine()
      lineStart = index + 1
      continue
    }

    ctx.font = fontForStyle(item.style)
    const charWidth = ctx.measureText(item.char).width
    if (width + charWidth > maxWidth && lineChars.length > 0) {
      pushLine()
      lineStart = index
    }

    lineChars.push(item)
    lineXs.push(lineXs[lineXs.length - 1] + charWidth)
    width += charWidth
  }

  pushLine()

  return lines
}

export function caretRect(
  _ctx: CanvasRenderingContext2D,
  lines: LineBox[],
  index: number,
  left: number,
  lineHeight: number,
): CaretRect {
  const line = lineForIndex(lines, index)
  const offset = Math.min(Math.max(index - line.start, 0), line.chars.length)

  return {
    x: left + (line.xs[offset] ?? 0),
    y: line.y,
    height: lineHeight,
  }
}

export function hitTestChar(
  _ctx: CanvasRenderingContext2D,
  lines: LineBox[],
  x: number,
  y: number,
  left: number,
  lineHeight: number,
): number {
  const line = lineForY(lines, y, lineHeight)

  if (x <= left || line.chars.length === 0) {
    return line.start
  }

  for (let offset = 0; offset < line.chars.length; offset++) {
    const start = line.xs[offset] ?? 0
    const end = line.xs[offset + 1] ?? start
    if (x < left + start + (end - start) / 2) {
      return line.start + offset
    }
  }

  return line.end
}

export function lineForIndex(lines: LineBox[], index: number): LineBox {
  return (
    lines.find((line) => index >= line.start && index <= line.end) ??
    lines[lines.length - 1]
  )
}

function lineForY(lines: LineBox[], y: number, lineHeight: number): LineBox {
  return (
    lines.find((line) => y >= line.y && y < line.y + lineHeight) ??
    (y < lines[0].y ? lines[0] : lines[lines.length - 1])
  )
}
