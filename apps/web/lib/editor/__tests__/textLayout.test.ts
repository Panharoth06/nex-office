import { describe, expect, it } from 'vitest'
import {
  caretRect,
  hitTestChar,
  layoutChars,
  type StyledChar,
  type TextStyle,
} from '../textLayout'

function chars(text: string, style: TextStyle = {}): StyledChar[] {
  return Array.from(text).map((char) => ({ char, style }))
}

function context(charWidth = 10): CanvasRenderingContext2D {
  return {
    font: '',
    measureText(text: string) {
      return { width: Array.from(text).length * charWidth } as TextMetrics
    },
  } as unknown as CanvasRenderingContext2D
}

describe('layoutChars alignment', () => {
  it('keeps left-aligned text at the content origin', () => {
    const lines = layoutChars(context(), chars('hello'), 100, 24, 0)
    expect(lines).toHaveLength(1)
    expect(lines[0].left).toBe(0)
    expect(lines[0].width).toBe(50)
  })

  it('centers and right-aligns non-wrapping lines', () => {
    const centered = layoutChars(
      context(),
      chars('hello', { align: 'center' }),
      100,
      24,
      0,
    )
    const right = layoutChars(
      context(),
      chars('hello', { align: 'right' }),
      100,
      24,
      0,
    )

    expect(centered[0].left).toBe(25)
    expect(right[0].left).toBe(50)
  })

  it('reserves a hanging indent for list markers', () => {
    const lines = layoutChars(
      context(),
      chars('One', { list: 'ol', listLevel: 1 }),
      100,
      24,
      0,
    )

    expect(lines[0].prefix).toBe('1.')
    expect(lines[0].prefixX).toBe(30)
    expect(lines[0].left).toBe(60)
    expect(lines[0].width).toBe(30)
  })

  it('places the caret and hit-tests on aligned lines using the same offset', () => {
    const ctx = context()
    const lines = layoutChars(
      ctx,
      chars('hello', { align: 'center' }),
      100,
      24,
      0,
    )
    const caret = caretRect(ctx, lines, 2, 96)

    expect(caret.x).toBe(96 + 25 + 20)
    expect(hitTestChar(ctx, lines, caret.x, 10, 96)).toBe(2)
  })

  it('keeps an empty trailing paragraph as a line', () => {
    const lines = layoutChars(context(), chars('a\n'), 100, 24, 0)
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatchObject({ start: 2, end: 2, left: 0 })
  })

  it('flows lines across pages', () => {
    const ctx = context()
    const lines = layoutChars(ctx, chars('a\nb\nc\nd\ne\nf\n'), 100, 24, 0, {
      pageHeight: 100,
      marginTop: 10,
      marginBottom: 10,
      pageGap: 20,
    })

    expect(lines[0].page).toBe(0)
    expect(lines[lines.length - 1].page).toBeGreaterThan(0)
  })
})
