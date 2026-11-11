import { describe, expect, it } from 'vitest'
import {
  EMPTY_FORMAT_STATE,
  formatStateAtCaret,
  formatStateForRange,
  styledCharsFromDelta,
  type TextDeltaSegment,
} from '../richText'

describe('richText block marks', () => {
  it('parses list and alignment attributes from a delta', () => {
    const delta: TextDeltaSegment[] = [
      {
        insert: 'One',
        attributes: { list: 'ol', list_level: '2', align: 'right' },
      },
    ]

    const [first] = styledCharsFromDelta(delta)
    expect(first.style).toMatchObject({
      list: 'ol',
      listLevel: 2,
      align: 'right',
    })
  })

  it('reads block state at a caret inside text and at its end', () => {
    const delta: TextDeltaSegment[] = [
      {
        insert: 'One',
        attributes: { list: 'ol', list_level: '0', align: 'center' },
      },
      { insert: '\n', attributes: { align: 'center' } },
      { insert: 'Two', attributes: { list: 'ul', list_level: '1' } },
    ]

    expect(formatStateAtCaret(delta, 1)).toMatchObject({
      list: 'ol',
      listLevel: 0,
      align: 'center',
    })
    expect(formatStateAtCaret(delta, 3)).toMatchObject({
      list: 'ol',
      align: 'center',
    })
    expect(formatStateAtCaret(delta, 4)).toMatchObject({
      list: 'ul',
      listLevel: 1,
      align: 'center',
    })
  })

  it('reads a trailing empty list item from its leading newline', () => {
    const delta: TextDeltaSegment[] = [
      {
        insert: 'One',
        attributes: { list: 'ol', list_level: '0' },
      },
      { insert: '\n', attributes: { list: 'ol', list_level: '2' } },
    ]

    expect(formatStateAtCaret(delta, 4)).toMatchObject({
      list: 'ol',
      listLevel: 2,
    })
  })

  it('reports mixed block state as defaults for a ranged selection', () => {
    const delta: TextDeltaSegment[] = [
      {
        insert: 'One',
        attributes: { list: 'ol', align: 'center' },
      },
      { insert: '\n', attributes: { align: 'center' } },
      { insert: 'Two', attributes: { list: 'ul' } },
    ]

    expect(formatStateForRange(delta, 0, 7)).toMatchObject({
      paragraph: 'normal',
      list: null,
      listLevel: 0,
      align: 'center',
    })
  })

  it('returns an empty state for an empty document', () => {
    expect(formatStateAtCaret([], 0)).toEqual(EMPTY_FORMAT_STATE)
  })
})
