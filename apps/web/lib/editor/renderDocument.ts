import { fontForStyle, type LineBox, type TextStyle } from './textLayout'

export interface RichRenderOptions {
  selectionStart: number
  selectionEnd: number
  margin: number
  lineHeight: number
}

/**
 * Draw selection highlights and styled text runs for laid-out lines.
 *
 * The paint order is selection first, then glyphs, so selected text stays
 * readable. Underlines are drawn after their run.
 */
export function drawRichDocument(
  ctx: CanvasRenderingContext2D,
  lines: LineBox[],
  options: RichRenderOptions,
): void {
  const { selectionStart, selectionEnd, margin, lineHeight } = options

  for (const line of lines) {
    const from = Math.max(selectionStart, line.start)
    const to = Math.min(selectionEnd, line.end)

    if (from < to) {
      const x1 = margin + (line.xs[from - line.start] ?? 0)
      const x2 = margin + (line.xs[to - line.start] ?? 0)
      ctx.fillStyle = '#dbeafe'
      ctx.fillRect(x1, line.y, x2 - x1, lineHeight)
    }

    let offset = 0
    while (offset < line.chars.length) {
      const style = line.chars[offset].style
      let end = offset + 1
      while (end < line.chars.length && sameStyle(line.chars[end].style, style)) {
        end += 1
      }

      const text = line.chars
        .slice(offset, end)
        .map((item) => item.char)
        .join('')
      const x = margin + (line.xs[offset] ?? 0)

      ctx.font = fontForStyle(style)
      ctx.fillStyle = '#0f172a'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(text, x, line.y)

      if (style.underline) {
        const width = (line.xs[end] ?? 0) - (line.xs[offset] ?? 0)
        ctx.fillRect(x, line.y + lineHeight - 3, width, 1)
      }

      offset = end
    }
  }
}

function sameStyle(a: TextStyle, b: TextStyle): boolean {
  return (
    a.bold === b.bold && a.italic === b.italic && a.underline === b.underline
  )
}
