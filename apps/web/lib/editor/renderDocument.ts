import { fontForStyle, type LineBox, type TextStyle } from './textLayout'

export interface RichRenderOptions {
  selectionStart: number
  selectionEnd: number
  margin: number
}

/**
 * Draw list markers, selection highlights, and styled text runs for laid-out
 * lines. All horizontal geometry comes from `LineBox.left`/`prefixX` so the
 * renderer, caret, and hit-testing never drift apart.
 */
export function drawRichDocument(
  ctx: CanvasRenderingContext2D,
  lines: LineBox[],
  options: RichRenderOptions,
): void {
  const { selectionStart, selectionEnd, margin } = options

  for (const line of lines) {
    if (line.prefix && line.prefixX !== undefined) {
      ctx.font = fontForStyle(line.style)
      ctx.fillStyle = '#0f172a'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(line.prefix, margin + line.prefixX, line.y)
    }

    const from = Math.max(selectionStart, line.start)
    const to = Math.min(selectionEnd, line.end)

    if (from < to) {
      const x1 = margin + line.left + (line.xs[from - line.start] ?? 0)
      const x2 = margin + line.left + (line.xs[to - line.start] ?? 0)
      ctx.fillStyle = '#dbeafe'
      ctx.fillRect(x1, line.y, x2 - x1, line.height)
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
      const x = margin + line.left + (line.xs[offset] ?? 0)
      const runStyle: TextStyle = {
        ...style,
        paragraph: line.style.paragraph,
      }

      ctx.font = fontForStyle(runStyle)
      ctx.fillStyle = '#0f172a'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(text, x, line.y)

      if (style.underline) {
        const width = (line.xs[end] ?? 0) - (line.xs[offset] ?? 0)
        ctx.fillRect(x, line.y + line.height - 3, width, 1)
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
