import { computed, ref, shallowRef, type Ref } from 'vue'
import { caretRect, layoutChars, type LineBox, type StyledChar } from '~/lib/editor/textLayout'
import { drawPageBackground, setupCanvas } from '~/lib/editor/canvas'
import { styledCharsFromDelta, type FormatState } from '~/lib/editor/richText'
import { drawRichDocument } from '~/lib/editor/renderDocument'
import type { TextEngine } from '~/lib/editor/useEngine'
import {
  HEADER_TOP,
  footerExtra,
  footerTop,
  headerExtra,
  linesForPage,
  repeatZoneLines,
  zoneHeight,
  type EditorZone,
} from '~/lib/editor/zones'
import type { EditorZonesApi } from '~/composables/useEditorZones'

export interface EditorPainterOptions {
  engine: () => TextEngine | null
  zones: () => EditorZonesApi
  ready: () => boolean
  bgCanvas: Ref<HTMLCanvasElement | null>
  docCanvas: Ref<HTMLCanvasElement | null>
  overlayCanvas: Ref<HTMLCanvasElement | null>
  pageWidth: number
  pageHeight: number
  pageGap: number
  margin: number
  lineHeight: number
  onFormatState: (state: FormatState) => void
}

/** Layout and canvas painting for body, header, and footer zones. */
export function useEditorPainter(options: EditorPainterOptions) {
  const { pageWidth, pageHeight, pageGap, margin, lineHeight } = options
  const contentWidth = pageWidth - margin * 2
  const stride = pageHeight + pageGap
  const placeholderFont = '13px "Helvetica Neue", Arial, sans-serif'
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  const docContext = shallowRef<CanvasRenderingContext2D | null>(null)
  let overlayCtx: CanvasRenderingContext2D | null = null
  const bodyLines = shallowRef<LineBox[]>([])
  const headerLines = shallowRef<LineBox[]>([])
  const footerLines = shallowRef<LineBox[]>([])
  const bodyContentTop = ref(margin)
  const bodyContentBottom = ref(margin)
  const headerContentBottom = ref(HEADER_TOP + lineHeight)
  const footerContentTop = ref(footerTop(pageHeight, lineHeight))
  const caret = ref({ x: margin, y: margin, height: lineHeight })
  const composing = ref('')
  const mirrorText = ref('')
  const pageCount = ref(1)
  const totalHeight = computed(
    () => pageCount.value * pageHeight + (pageCount.value - 1) * pageGap,
  )

  let caretVisible = true

  function applyCanvasSize() {
    const canvases = [options.bgCanvas.value, options.docCanvas.value, options.overlayCanvas.value]
    for (const canvas of canvases) {
      if (!canvas) return
      canvas.width = pageWidth * dpr
      canvas.height = totalHeight.value * dpr
      canvas.style.width = `${pageWidth}px`
      canvas.style.height = `${totalHeight.value}px`
    }

    if (options.bgCanvas.value) setupCanvas(options.bgCanvas.value, dpr)
    if (options.docCanvas.value) docContext.value = setupCanvas(options.docCanvas.value, dpr)
    if (options.overlayCanvas.value) overlayCtx = setupCanvas(options.overlayCanvas.value, dpr)
  }

  function drawBackground() {
    const canvas = options.bgCanvas.value
    if (!canvas) return
    drawPageBackground(canvas.getContext('2d')!, {
      pageWidth,
      pageHeight,
      margin,
      contentWidth,
      contentTop: bodyContentTop.value,
      contentBottom: bodyContentBottom.value,
      pageCount: pageCount.value,
      pageGap,
    })
  }

  function zoneChars(zone: EditorZone): StyledChar[] {
    const engine = options.engine()
    if (!engine) return []
    const text = engine.getText(zone)
    let chars = styledCharsFromDelta(engine.getDelta(zone))
    if (chars.length !== Array.from(text).length) {
      chars = Array.from(text).map((char) => ({ char, style: {} }))
    }
    return chars
  }

  function redraw() {
    const ctx = docContext.value
    if (!ctx || !options.engine()) return

    composing.value = ''
    const bodyChars = zoneChars('body')
    const headerChars = zoneChars('header')
    const footerChars = zoneChars('footer')
    const headerBase = layoutChars(ctx, headerChars, contentWidth, lineHeight, 0)
    const footerBase = layoutChars(ctx, footerChars, contentWidth, lineHeight, 0)
    const headerHeight = zoneHeight(headerBase)
    const footerHeight = zoneHeight(footerBase)
    const footerOffset = footerTop(pageHeight, footerHeight)

    bodyContentTop.value = margin + headerExtra(headerHeight, margin)
    bodyContentBottom.value = margin + footerExtra(footerHeight, margin)
    headerContentBottom.value = HEADER_TOP + headerHeight
    footerContentTop.value = footerOffset

    const nextBodyLines = layoutChars(
      ctx,
      bodyChars,
      contentWidth,
      lineHeight,
      bodyContentTop.value,
      {
        pageHeight,
        marginTop: bodyContentTop.value,
        marginBottom: bodyContentBottom.value,
        pageGap,
      },
    )
    const nextPageCount = nextBodyLines.length
      ? nextBodyLines[nextBodyLines.length - 1].page + 1
      : 1

    if (nextPageCount !== pageCount.value) {
      pageCount.value = nextPageCount
      applyCanvasSize()
    }

    bodyLines.value = nextBodyLines
    headerLines.value = repeatZoneLines(headerBase, pageCount.value, stride, HEADER_TOP)
    footerLines.value = repeatZoneLines(footerBase, pageCount.value, stride, footerOffset)
    options.zones().clampActivePage(pageCount.value)
    options.zones().clampAll(bodyChars.length, headerChars.length, footerChars.length)

    drawBackground()
    ctx.clearRect(0, 0, pageWidth, totalHeight.value)
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    const zones = options.zones()
    drawRichDocument(ctx, bodyLines.value, {
      selectionStart: zones.activeZone.value === 'body' ? zones.selectionStart.value : -1,
      selectionEnd: zones.activeZone.value === 'body' ? zones.selectionEnd.value : -1,
      margin,
    })
    drawZone('header', headerChars.length === 0, HEADER_TOP)
    drawZone('footer', footerChars.length === 0, footerOffset)

    updateCaret()
    markTyped()
  }

  function drawZone(
    zone: Exclude<EditorZone, 'body'>,
    empty: boolean,
    baseTop: number,
  ) {
    const ctx = docContext.value
    if (!ctx) return
    const zones = options.zones()
    const lines = zone === 'header' ? headerLines.value : footerLines.value
    for (let page = 0; page < pageCount.value; page += 1) {
      const active = zones.activeZone.value === zone && zones.activePage.value === page
      drawRichDocument(ctx, linesForPage(lines, page), {
        selectionStart: active ? zones.selectionStart.value : -1,
        selectionEnd: active ? zones.selectionEnd.value : -1,
        margin,
      })
      if (empty && !active && page === 0) {
        ctx.font = placeholderFont
        ctx.fillStyle = '#94a3b8'
        ctx.textBaseline = 'top'
        ctx.fillText(
          zone === 'header' ? 'Header' : 'Footer',
          margin,
          page * stride + baseTop,
        )
      }
    }
  }

  function updateCaret() {
    const ctx = docContext.value
    if (!ctx) return
    const zones = options.zones()
    const zone = zones.activeZone.value
    const lines = zone === 'body' ? bodyLines.value : zones.linesFor(zone)
    caret.value = caretRect(ctx, lines, zones.caretIndex.value, margin)
    mirrorText.value = options.engine()?.getText(zone) ?? ''
    options.onFormatState(zones.currentFormatState())
  }

  function drawOverlay() {
    if (!overlayCtx) return
    overlayCtx.clearRect(0, 0, pageWidth, totalHeight.value)

    const zones = options.zones()
    const zone = zones.activeZone.value
    if (zone !== 'body' && options.ready()) {
      const pageTop = zones.activePage.value * stride
      const y =
        zone === 'header'
          ? pageTop + Math.min(headerContentBottom.value + 4, bodyContentTop.value)
          : pageTop + Math.max(footerContentTop.value - 4, pageHeight - bodyContentBottom.value)
      overlayCtx.strokeStyle = '#c7d2fe'
      overlayCtx.lineWidth = 1
      overlayCtx.beginPath()
      overlayCtx.moveTo(margin, y)
      overlayCtx.lineTo(margin + contentWidth, y)
      overlayCtx.stroke()
    }

    if (options.ready() && caretVisible) {
      overlayCtx.fillStyle = '#2563eb'
      overlayCtx.fillRect(caret.value.x, caret.value.y, 2, caret.value.height)
    }

    if (composing.value) {
      overlayCtx.font = '16px "Helvetica Neue", Arial, "Noto Sans CJK SC", "Noto Sans", sans-serif'
      overlayCtx.fillStyle = '#94a3b8'
      overlayCtx.textBaseline = 'top'
      overlayCtx.fillText(composing.value, caret.value.x + 2, caret.value.y)
      overlayCtx.fillRect(
        caret.value.x + 2,
        caret.value.y + caret.value.height - 2,
        overlayCtx.measureText(composing.value).width,
        1,
      )
    }
  }

  function markTyped() {
    caretVisible = true
    drawOverlay()
  }

  function toggleCaret() {
    caretVisible = !caretVisible
    drawOverlay()
  }

  return {
    docContext,
    bodyLines,
    headerLines,
    footerLines,
    bodyContentTop,
    bodyContentBottom,
    caret,
    composing,
    mirrorText,
    pageCount,
    totalHeight,
    applyCanvasSize,
    drawBackground,
    redraw,
    updateCaret,
    drawOverlay,
    markTyped,
    toggleCaret,
  }
}
