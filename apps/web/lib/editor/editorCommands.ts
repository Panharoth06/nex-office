import { blockAt, blocksInRange, paragraphBlocks, type ParagraphBlock } from './paragraphs'
import {
  styledCharsFromDelta,
  type FormatKey,
  type FormatState,
  type TextDeltaSegment,
} from './richText'
import type { StyledChar, TextStyle } from './textLayout'
import type { TextEngine } from './useEngine'

const INLINE_KEYS: FormatKey[] = ['bold', 'italic', 'underline']

/** Paragraph blocks touched by a selection. */
export function blocksForRange(
  delta: TextDeltaSegment[],
  start: number,
  end: number,
): ParagraphBlock[] {
  return blocksInRange(paragraphBlocks(styledCharsFromDelta(delta)), start, end)
}

/** Paragraph block at a collapsed caret. */
export function blockForCaret(
  delta: TextDeltaSegment[],
  index: number,
): ParagraphBlock {
  return blockAt(paragraphBlocks(styledCharsFromDelta(delta)), index)
}

/** Convert a paragraph block's style into a full formatting state. */
export function blockFormatState(block: ParagraphBlock): FormatState {
  return {
    bold: block.style.bold === true,
    italic: block.style.italic === true,
    underline: block.style.underline === true,
    paragraph: block.style.paragraph ?? 'normal',
    list: block.style.list ?? null,
    listLevel: block.style.listLevel ?? 0,
    align: block.style.align ?? 'left',
  }
}

/** Apply only bold/italic/underline to a text range. */
export function applyInlineFormat(
  engine: TextEngine,
  start: number,
  end: number,
  state: Pick<FormatState, FormatKey>,
): void {
  if (start >= end) return
  for (const key of INLINE_KEYS) {
    engine.setMark(start, end, key, state[key])
  }
}

/** Apply paragraph/list/alignment marks to a text range. */
export function applyBlockStateToRange(
  engine: TextEngine,
  start: number,
  end: number,
  state: FormatState,
): void {
  if (start >= end) return

  setStringMark(
    engine,
    start,
    end,
    'paragraph',
    state.paragraph === 'normal' ? null : state.paragraph,
  )
  setStringMark(engine, start, end, 'list', state.list)
  if (state.list) {
    setStringMark(engine, start, end, 'list_level', String(state.listLevel))
  } else {
    engine.clearMark(start, end, 'list_level')
  }
  setStringMark(engine, start, end, 'align', state.align === 'left' ? null : state.align)
}

/** Apply paragraph/list/alignment marks to a paragraph and its start marker. */
export function applyBlockState(
  engine: TextEngine,
  block: ParagraphBlock,
  state: FormatState,
): void {
  if (block.end > block.start) {
    applyBlockStateToRange(engine, block.start, block.end, state)
  }
  if (block.leadingNewline !== null) {
    applyBlockStateToRange(
      engine,
      block.leadingNewline,
      block.leadingNewline + 1,
      state,
    )
  }
}

/** Insert styled characters and apply their inline and block marks. */
export function insertStyledChars(
  engine: TextEngine,
  pos: number,
  chars: StyledChar[],
): number {
  if (chars.length === 0) return pos

  engine.insertText(
    pos,
    chars.map((item) => item.char).join(''),
  )

  let start = 0
  while (start < chars.length) {
    let end = start + 1
    while (end < chars.length && sameTextStyle(chars[end].style, chars[start].style)) {
      end += 1
    }
    const style = chars[start].style
    applyFullFormat(engine, pos + start, pos + end, {
      bold: style.bold === true,
      italic: style.italic === true,
      underline: style.underline === true,
      paragraph: style.paragraph ?? 'normal',
      list: style.list ?? null,
      listLevel: style.listLevel ?? 0,
      align: style.align ?? 'left',
    })
    start = end
  }

  return pos + chars.length
}

function sameTextStyle(a: TextStyle, b: TextStyle): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    (a.paragraph ?? 'normal') === (b.paragraph ?? 'normal') &&
    (a.list ?? null) === (b.list ?? null) &&
    (a.listLevel ?? 0) === (b.listLevel ?? 0) &&
    (a.align ?? 'left') === (b.align ?? 'left')
  )
}

/** Apply the complete formatting state to freshly inserted text. */
export function applyFullFormat(
  engine: TextEngine,
  start: number,
  end: number,
  state: FormatState,
): void {
  if (start >= end) return
  applyInlineFormat(engine, start, end, state)
  applyBlockStateToRange(engine, start, end, state)
}

/** Toggle or convert the list type for every paragraph in a selection. */
export function toggleListRange(
  engine: TextEngine,
  start: number,
  end: number,
  type: FormatState['list'],
): FormatState | null {
  const blocks = blocksForRange(engine.getDelta(), start, end)
  if (blocks.length === 0 || type === null) return null

  const allSame = blocks.every((block) => block.style.list === type)
  let firstFormat: FormatState | null = null

  for (const block of blocks) {
    const current = blockFormatState(block)
    const next: FormatState = allSame
      ? { ...current, list: null, listLevel: 0 }
      : {
          ...current,
          list: type,
          listLevel: current.list ? current.listLevel : 0,
        }
    applyBlockState(engine, block, next)
    firstFormat ??= next
  }

  return firstFormat
}

/** Set paragraph alignment for every paragraph in a selection. */
export function setAlignmentRange(
  engine: TextEngine,
  start: number,
  end: number,
  align: FormatState['align'],
): FormatState | null {
  const blocks = blocksForRange(engine.getDelta(), start, end)
  if (blocks.length === 0) return null

  let firstFormat: FormatState | null = null
  for (const block of blocks) {
    const next: FormatState = { ...blockFormatState(block), align }
    applyBlockState(engine, block, next)
    firstFormat ??= next
  }

  return firstFormat
}

/**
 * Increase or decrease list nesting.
 *
 * A negative step at the outermost level exits the list, matching Google Docs
 * and canvas-editor's list outdent behavior. Returns `null` when the selection
 * does not contain a list paragraph.
 */
export function changeListLevelRange(
  engine: TextEngine,
  start: number,
  end: number,
  delta: number,
): FormatState | null {
  const blocks = blocksForRange(engine.getDelta(), start, end).filter(
    (block) => block.style.list,
  )
  if (blocks.length === 0) return null

  let firstFormat: FormatState | null = null
  for (const block of blocks) {
    const current = blockFormatState(block)
    const level = current.listLevel ?? 0
    const next: FormatState =
      delta < 0 && level === 0
        ? { ...current, list: null, listLevel: 0 }
        : {
            ...current,
            listLevel: Math.max(0, Math.min(8, level + delta)),
          }
    applyBlockState(engine, block, next)
    firstFormat ??= next
  }

  return firstFormat
}

/**
 * Insert a paragraph break at a collapsed caret.
 *
 * The inserted newline is the start marker for the following paragraph. List
 * items continue, headings reset to Normal, and alignment is inherited.
 */
export function insertParagraphAt(
  engine: TextEngine,
  caret: number,
  inlineState: FormatState,
): { caret: number; format: FormatState } {
  const chars = styledCharsFromDelta(engine.getDelta())
  const block = blockAt(paragraphBlocks(chars), caret)
  const current = blockFormatState(block)

  if (current.list && block.empty) {
    const next: FormatState =
      current.listLevel > 0
        ? { ...current, listLevel: current.listLevel - 1 }
        : { ...current, list: null, listLevel: 0 }
    applyBlockState(engine, block, next)
    return {
      caret,
      format: withInlineMarks(next, inlineState),
    }
  }

  let next: FormatState
  let resetPreviousParagraph = false

  if (caret > block.start && caret < block.end) {
    next = current
  } else if (caret === block.start && !block.empty) {
    next = current
    resetPreviousParagraph = true
  } else {
    next = { ...current, paragraph: 'normal' }
  }

  engine.insertText(caret, '\n')
  applyBlockStateToRange(engine, caret, caret + 1, next)

  if (resetPreviousParagraph && block.leadingNewline !== null) {
    const previous: FormatState = {
      ...current,
      paragraph: 'normal',
      list: next.list,
      listLevel: next.listLevel,
    }
    applyBlockStateToRange(
      engine,
      block.leadingNewline,
      block.leadingNewline + 1,
      previous,
    )
  }

  return {
    caret: caret + 1,
    format: withInlineMarks(next, inlineState),
  }
}

function withInlineMarks(
  state: FormatState,
  inline: Pick<FormatState, 'bold' | 'italic' | 'underline'>,
): FormatState {
  return {
    ...state,
    bold: inline.bold,
    italic: inline.italic,
    underline: inline.underline,
  }
}

function setStringMark(
  engine: TextEngine,
  start: number,
  end: number,
  key: string,
  value: string | null,
): void {
  if (value === null) {
    engine.clearMark(start, end, key)
  } else {
    engine.setMarkValue(start, end, key, value)
  }
}
