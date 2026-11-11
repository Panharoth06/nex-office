export interface PageFrame {
  pageWidth: number
  pageHeight: number
  margin: number
  contentWidth: number
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

/** Paint the paper, margin guide, and page number for the current page. */
export function drawPageBackground(ctx: CanvasRenderingContext2D, frame: PageFrame): void {
  const { pageWidth, pageHeight, margin, contentWidth } = frame
  ctx.clearRect(0, 0, pageWidth, pageHeight)
  ctx.strokeStyle = '#e2e8f0'
  ctx.setLineDash([4, 4])
  ctx.strokeRect(margin, margin, contentWidth, pageHeight - margin * 2)
  ctx.setLineDash([])
  ctx.fillStyle = '#94a3b8'
  ctx.font = '12px "Helvetica Neue", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('1', pageWidth / 2, pageHeight - 32)
}
