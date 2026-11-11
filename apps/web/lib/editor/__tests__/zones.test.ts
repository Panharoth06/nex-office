import { describe, expect, it } from 'vitest'
import {
  FOOTER_BOTTOM,
  HEADER_TOP,
  footerExtra,
  footerTop,
  headerExtra,
  linesForPage,
  repeatZoneLines,
  zoneAtPoint,
  zoneHeight,
} from '../zones'
import type { LineBox } from '../textLayout'

function line(y: number, height = 24): LineBox {
  return {
    chars: [],
    xs: [0],
    start: 0,
    end: 0,
    y,
    height,
    page: 0,
    left: 0,
    width: 0,
    style: {},
  }
}

describe('zone geometry', () => {
  it('adds extra body margin only when header/footer overflow', () => {
    expect(headerExtra(24, 96)).toBe(0)
    expect(headerExtra(96, 96)).toBe(HEADER_TOP)

    expect(footerExtra(24, 96)).toBe(0)
    expect(footerExtra(96, 96)).toBe(FOOTER_BOTTOM)
  })

  it('anchors footer content above the bottom inset', () => {
    expect(footerTop(1123, 24)).toBe(1123 - FOOTER_BOTTOM - 24)
  })

  it('repeats linked content on every page', () => {
    const base = [line(0), line(24)]
    const repeated = repeatZoneLines(base, 3, 1155, HEADER_TOP)

    expect(repeated).toHaveLength(6)
    expect(repeated[0]).toMatchObject({ page: 0, y: 40 })
    expect(repeated[2]).toMatchObject({ page: 1, y: 1195 })
    expect(repeated[4]).toMatchObject({ page: 2, y: 2350 })
    expect(zoneHeight(base)).toBe(48)
  })

  it('filters repeated lines by page', () => {
    const repeated = repeatZoneLines([line(0)], 2, 1155, 40)
    expect(linesForPage(repeated, 1)).toHaveLength(1)
    expect(linesForPage(repeated, 1)[0].y).toBe(1195)
  })

  it('classifies clicks by body margins', () => {
    expect(zoneAtPoint(40, 96, 96, 1123)).toBe('header')
    expect(zoneAtPoint(500, 96, 96, 1123)).toBe('body')
    expect(zoneAtPoint(1100, 96, 96, 1123)).toBe('footer')
  })
})
