import type { LineBox } from './textLayout'

export type EditorZone = 'body' | 'header' | 'footer'

/** Header content starts this far below the page top. */
export const HEADER_TOP = 40
/** Footer content ends this far above the page bottom. */
export const FOOTER_BOTTOM = 40

/** Total layout height of a zone's lines. */
export function zoneHeight(lines: LineBox[]): number {
  return lines.reduce((total, line) => total + line.height, 0)
}

/** Extra body top margin needed when a header grows past the paper margin. */
export function headerExtra(height: number, margin: number): number {
  return Math.max(0, HEADER_TOP + height - margin)
}

/** Extra body bottom margin needed when a footer grows past the paper margin. */
export function footerExtra(height: number, margin: number): number {
  return Math.max(0, height - (margin - FOOTER_BOTTOM))
}

/** Absolute top of footer content for a page. */
export function footerTop(pageHeight: number, footerHeight: number): number {
  return pageHeight - FOOTER_BOTTOM - footerHeight
}

/**
 * Repeat single-page header/footer lines across every page.
 *
 * Header and footer content is linked across pages; the CRDT stores one copy.
 */
export function repeatZoneLines(
  baseLines: LineBox[],
  pageCount: number,
  stride: number,
  topOffset: number,
): LineBox[] {
  const lines: LineBox[] = []
  for (let page = 0; page < pageCount; page += 1) {
    for (const line of baseLines) {
      lines.push({
        ...line,
        y: page * stride + topOffset + line.y,
        page,
      })
    }
  }
  return lines
}

/** Return the repeated lines belonging to one page. */
export function linesForPage(lines: LineBox[], page: number): LineBox[] {
  return lines.filter((line) => line.page === page)
}

/** Classify a click inside a page as body, header, or footer. */
export function zoneAtPoint(
  localY: number,
  bodyTop: number,
  bodyBottom: number,
  pageHeight: number,
): EditorZone {
  if (localY < bodyTop) return 'header'
  if (localY > pageHeight - bodyBottom) return 'footer'
  return 'body'
}
