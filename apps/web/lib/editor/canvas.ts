export interface PageFrame {
  pageWidth: number
  pageHeight: number
  margin: number
  contentWidth: number
  pageCount: number
  pageGap: number
}

/**
 * Prepare a canvas for device-pixel-ratio rendering.
 *
 * The context transform is set once so all drawing code uses CSS pixels.
 */
export function setupCanvas(canvas: HTMLCanvasElement, dpr: number): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

/** Paint stacked paper pages, margin guides, and page numbers. */
export function drawPageBackground(ctx: CanvasRenderingContext2D, frame: PageFrame): void {
  const { pageWidth, pageHeight, margin, contentWidth, pageCount, pageGap } = frame
  const stride = pageHeight + pageGap
  const totalHeight = pageCount * pageHeight + (pageCount - 1) * pageGap

  ctx.clearRect(0, 0, pageWidth, totalHeight)
  ctx.font = '12px "Helvetica Neue", Arial, sans-serif'

  for (let page = 0; page < pageCount; page += 1) {
    const top = page * stride

    ctx.save()
    ctx.shadowColor = 'rgba(15, 23, 42, 0.18)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, top, pageWidth, pageHeight)
    ctx.restore()

    ctx.strokeStyle = '#e2e8f0'
    ctx.setLineDash([4, 4])
    ctx.strokeRect(margin, top + margin, contentWidth, pageHeight - margin * 2)
    ctx.setLineDash([])

    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(String(page + 1), pageWidth / 2, top + pageHeight - 32)
  }
}
