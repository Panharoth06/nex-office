import { describe, expect, it } from 'vitest'
import { listMarkers } from '../listNumbering'
import { paragraphBlocks } from '../paragraphs'
import type { StyledChar, TextStyle } from '../textLayout'

function blockChars(
  paragraphs: Array<{ text: string; style?: TextStyle }>,
): StyledChar[] {
  const chars: StyledChar[] = []
  paragraphs.forEach((paragraph, index) => {
    for (const char of Array.from(paragraph.text)) {
      chars.push({ char, style: paragraph.style ?? {} })
    }
    if (index < paragraphs.length - 1) {
      const nextStyle = paragraphs[index + 1]?.style ?? {}
      chars.push({ char: '\n', style: nextStyle })
    }
  })
  return chars
}

function markers(paragraphs: Array<{ text: string; style?: TextStyle }>) {
  return listMarkers(paragraphBlocks(blockChars(paragraphs)))
}

describe('listMarkers', () => {
  it('numbers a contiguous ordered list and restarts after a normal paragraph', () => {
    const result = markers([
      { text: 'One', style: { list: 'ol' } },
      { text: 'Two', style: { list: 'ol' } },
      { text: 'Break' },
      { text: 'Again', style: { list: 'ol' } },
    ])

    expect(result.map((marker) => marker?.prefix ?? null)).toEqual([
      '1.',
      '2.',
      null,
      '1.',
    ])
  })

  it('keeps parent numbering while nesting and restores it on outdent', () => {
    const result = markers([
      { text: 'Parent', style: { list: 'ol' } },
      { text: 'Child', style: { list: 'ul', listLevel: 1 } },
      { text: 'Child two', style: { list: 'ul', listLevel: 1 } },
      { text: 'Parent two', style: { list: 'ol' } },
    ])

    expect(result.map((marker) => marker?.prefix ?? null)).toEqual([
      '1.',
      '◦',
      '◦',
      '2.',
    ])
  })

  it('restarts numbering when the list type changes at the same level', () => {
    const result = markers([
      { text: 'One', style: { list: 'ol' } },
      { text: 'Two', style: { list: 'ol' } },
      { text: 'Bullet', style: { list: 'ul' } },
    ])

    expect(result.map((marker) => marker?.prefix ?? null)).toEqual([
      '1.',
      '2.',
      '•',
    ])
  })

  it('assigns numbering to empty list items', () => {
    const result = markers([
      { text: 'One', style: { list: 'ol' } },
      { text: '', style: { list: 'ol' } },
    ])

    expect(result[1]?.prefix).toBe('2.')
  })
})
