import { describe, expect, it } from 'vitest'
import { blockAt, blocksInRange, paragraphBlocks } from '../paragraphs'
import type { StyledChar, TextStyle } from '../textLayout'

function chars(text: string, style: TextStyle = {}): StyledChar[] {
  return Array.from(text).map((char) => ({ char, style }))
}

describe('paragraphBlocks', () => {
  it('keeps a trailing empty paragraph after a newline', () => {
    const blocks = paragraphBlocks(chars('hello\n'))
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ start: 0, end: 5, terminator: 5 })
    expect(blocks[1]).toMatchObject({
      start: 6,
      end: 6,
      terminator: null,
      leadingNewline: 5,
      empty: true,
    })
  })

  it('reads empty paragraph style from its leading newline', () => {
    const listStyle: TextStyle = { list: 'ol', listLevel: 1 }
    const input = chars('hello\n', listStyle)
    const blocks = paragraphBlocks(input)

    expect(blocks[1].style.list).toBe('ol')
    expect(blocks[1].style.listLevel).toBe(1)
  })

  it('represents consecutive empty paragraphs', () => {
    const blocks = paragraphBlocks(chars('a\n\nb'))
    expect(blocks.map((block) => [block.start, block.end])).toEqual([
      [0, 1],
      [2, 2],
      [3, 4],
    ])
  })

  it('resolves the paragraph at caret boundaries', () => {
    const blocks = paragraphBlocks(chars('a\n\nb'))
    expect(blockAt(blocks, 1).start).toBe(0)
    expect(blockAt(blocks, 2).empty).toBe(true)
    expect(blockAt(blocks, 3).start).toBe(3)
    expect(blockAt(blocks, 4).start).toBe(3)
  })

  it('includes empty paragraphs inside a selection', () => {
    const blocks = paragraphBlocks(chars('a\n\nb'))
    const selected = blocksInRange(blocks, 0, 4)
    expect(selected).toHaveLength(3)
  })
})
