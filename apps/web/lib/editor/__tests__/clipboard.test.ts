import { describe, expect, it } from 'vitest'
import {
  CLIPBOARD_MIME,
  charsFromDelta,
  clipboardPayloadFromChars,
  readClipboard,
  writeClipboard,
} from '../clipboard'
import type { StyledChar } from '../textLayout'

function repeated(text: string, style: StyledChar['style']): StyledChar[] {
  return Array.from(text).map((char) => ({ char, style }))
}

function fakeClipboard() {
  const store = new Map<string, string>()
  return {
    data: {
      getData: (type: string) => store.get(type) ?? '',
      setData: (type: string, value: string) => {
        store.set(type, value)
      },
    } as unknown as DataTransfer,
    store,
  }
}

describe('clipboard fragments', () => {
  it('writes plain text, HTML, and an internal fragment', () => {
    const { data, store } = fakeClipboard()
    writeClipboard(data, repeated('Title', {
      bold: true,
      paragraph: 'h1',
      align: 'center',
    }))

    expect(store.get('text/plain')).toBe('Title')
    expect(store.get('text/html')).toContain('<h1')
    expect(store.get('text/html')).toContain('text-align:center')
    expect(store.get('text/html')).toContain('<strong>Title</strong>')
    expect(store.get(CLIPBOARD_MIME)).toContain('"paragraph":"h1"')
  })

  it('round-trips rich formatting through the internal fragment', () => {
    const { data } = fakeClipboard()
    const chars: StyledChar[] = [
      ...repeated('One', {
        bold: true,
        italic: true,
        underline: true,
        paragraph: 'h2',
        align: 'right',
      }),
      { char: '\n', style: { paragraph: 'normal' } },
      ...repeated('Item', { list: 'ol', listLevel: 1 }),
    ]
    writeClipboard(data, chars)

    const payload = readClipboard(data)
    expect(payload?.kind).toBe('rich')
    if (payload?.kind !== 'rich') return
    expect(payload.chars.map((item) => item.char).join('')).toBe('One\nItem')
    expect(payload.chars[0].style).toMatchObject({
      bold: true,
      italic: true,
      underline: true,
      paragraph: 'h2',
      align: 'right',
    })
    expect(payload.chars[4].style).toMatchObject({
      list: 'ol',
      listLevel: 1,
    })
  })

  it('falls back to plain text when no rich fragment is available', () => {
    const { data } = fakeClipboard()
    data.setData('text/plain', 'Plain paste')

    expect(readClipboard(data)).toEqual({
      kind: 'plain',
      text: 'Plain paste',
    })
  })

  it('serializes lists and inline tags into HTML', () => {
    const payload = clipboardPayloadFromChars([
      ...repeated('Bold', { bold: true, list: 'ul' }),
      { char: '\n', style: {} },
      ...repeated('Italic', { italic: true, underline: true }),
    ])

    expect(payload.html).toContain('<ul><li')
    expect(payload.html).toContain('<strong>Bold</strong>')
    expect(payload.html).toContain('<em><u>Italic</u></em>')
  })

  it('slices clipboard characters from a delta', () => {
    const chars = charsFromDelta(
      [
        { insert: 'Hello', attributes: { bold: true } },
        { insert: ' world' },
      ],
      2,
      8,
    )
    expect(chars.map((item) => item.char).join('')).toBe('llo wo')
    expect(chars[0].style.bold).toBe(true)
    expect(chars[5].style.bold).toBe(false)
  })
})
