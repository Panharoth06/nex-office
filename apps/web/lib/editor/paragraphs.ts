import type { StyledChar, TextStyle } from './textLayout'

/**
 * A paragraph resolved from the flat rich-text character stream.
 *
 * `start`/`end` describe the visible text (the newline is excluded), while
 * `leadingNewline` is the paragraph-start marker. Block attributes live on the
 * marker as well as on the text so empty paragraphs and trailing list items
 * survive reloads.
 */
export interface ParagraphBlock {
  start: number
  end: number
  terminator: number | null
  leadingNewline: number | null
  style: TextStyle
  empty: boolean
}

/** Split styled characters into paragraph blocks, including trailing empties. */
export function paragraphBlocks(chars: StyledChar[]): ParagraphBlock[] {
  const blocks: ParagraphBlock[] = []
  let start = 0

  for (let index = 0; index <= chars.length; index += 1) {
    const terminator = index < chars.length && chars[index].char === '\n'
    if (!terminator && index !== chars.length) continue

    const end = index
    const leadingNewline = start > 0 ? start - 1 : null
    const style = resolveBlockStyle(chars, start, end, leadingNewline)
    blocks.push({
      start,
      end,
      terminator: terminator ? index : null,
      leadingNewline,
      style,
      empty: start === end,
    })
    start = index + 1
  }

  return blocks
}

/** Return the paragraph block containing a caret offset. */
export function blockAt(blocks: ParagraphBlock[], index: number): ParagraphBlock {
  return (
    blocks.find((block) => index >= block.start && index < block.end) ??
    blocks.find((block) => block.empty && index === block.start) ??
    blocks.find((block) => index === block.end) ??
    blocks[blocks.length - 1]
  )
}

/**
 * Return the paragraphs touched by a selection.
 *
 * A collapsed selection resolves to one paragraph. A ranged selection includes
 * empty paragraphs between the two endpoints.
 */
export function blocksInRange(
  blocks: ParagraphBlock[],
  start: number,
  end: number,
): ParagraphBlock[] {
  if (end <= start) return [blockAt(blocks, start)]

  return blocks.filter((block) => {
    if (block.empty) return block.start >= start && block.start < end
    return block.end > start && block.start < end
  })
}

function resolveBlockStyle(
  chars: StyledChar[],
  start: number,
  end: number,
  leadingNewline: number | null,
): TextStyle {
  const text = end > start ? chars[start]?.style : undefined
  const leading =
    leadingNewline !== null ? chars[leadingNewline]?.style : undefined

  return {
    bold: text?.bold === true,
    italic: text?.italic === true,
    underline: text?.underline === true,
    paragraph: text?.paragraph ?? leading?.paragraph ?? 'normal',
    list: text?.list ?? leading?.list,
    listLevel: text?.listLevel ?? leading?.listLevel ?? 0,
    align: text?.align ?? leading?.align ?? 'left',
  }
}
