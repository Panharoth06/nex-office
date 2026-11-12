import { describe, expect, it } from 'vitest'
import {
  changeListLevelRange,
  insertParagraphAt,
  insertStyledChars,
  setAlignmentRange,
  toggleListRange,
} from '../editorCommands'
import { EMPTY_FORMAT_STATE, formatStateAtCaret, type TextDeltaSegment } from '../richText'
import type { TextEngine } from '../useEngine'

interface FakeChar {
  char: string
  attributes: Record<string, string | boolean>
}

class FakeEngine implements TextEngine {
  private chars: FakeChar[] = []

  constructor(text = '') {
    this.chars = Array.from(text).map((char) => ({ char, attributes: {} }))
  }

  insertText(pos: number, text: string): void {
    const inserted = Array.from(text).map((char) => ({
      char,
      attributes: {},
    }))
    this.chars.splice(pos, 0, ...inserted)
  }

  deleteRange(pos: number, len: number): void {
    this.chars.splice(pos, len)
  }

  getText(): string {
    return this.chars.map((item) => item.char).join('')
  }

  setMark(
    start: number,
    end: number,
    key: 'bold' | 'italic' | 'underline',
    enabled: boolean,
  ): void {
    for (let index = start; index < end; index += 1) {
      if (enabled) this.chars[index].attributes[key] = true
      else delete this.chars[index].attributes[key]
    }
  }

  clearMark(start: number, end: number, key: string): void {
    for (let index = start; index < end; index += 1) {
      delete this.chars[index].attributes[key]
    }
  }

  setMarkValue(start: number, end: number, key: string, value: string): void {
    for (let index = start; index < end; index += 1) {
      this.chars[index].attributes[key] = value
    }
  }

  getDelta(): TextDeltaSegment[] {
    const segments: TextDeltaSegment[] = []
    for (const item of this.chars) {
      const attributes =
        Object.keys(item.attributes).length > 0 ? { ...item.attributes } : null
      const last = segments[segments.length - 1]
      if (
        last &&
        typeof last.insert === 'string' &&
        JSON.stringify(last.attributes ?? null) === JSON.stringify(attributes)
      ) {
        last.insert += item.char
      } else {
        segments.push({ insert: item.char, attributes })
      }
    }
    return segments
  }

  exportSnapshot(): Uint8Array {
    throw new Error('not implemented')
  }

  importSnapshot(): void {
    throw new Error('not implemented')
  }

  undo(): boolean {
    return false
  }

  redo(): boolean {
    return false
  }

  canUndo(): boolean {
    return false
  }

  canRedo(): boolean {
    return false
  }

  checkpoint(): void {}
}

describe('editorCommands block editing', () => {
  it('applies list marks to text and the following paragraph marker', () => {
    const engine = new FakeEngine('One\nTwo')
    const next = toggleListRange(engine, 0, 7, 'ol')

    expect(next?.list).toBe('ol')
    expect(formatStateAtCaret(engine.getDelta(), 1).list).toBe('ol')
    expect(formatStateAtCaret(engine.getDelta(), 4).list).toBe('ol')
    expect(engine.getText()).toBe('One\nTwo')

    const delta = engine.getDelta()
    const newlineSegment = delta.find((segment) =>
      typeof segment.insert === 'string' && segment.insert.includes('\n'),
    )
    expect(newlineSegment?.attributes).toMatchObject({ list: 'ol' })
  })

  it('turns a list off when every paragraph already has that type', () => {
    const engine = new FakeEngine('One\nTwo')
    toggleListRange(engine, 0, 7, 'ol')
    const next = toggleListRange(engine, 0, 7, 'ol')

    expect(next?.list).toBeNull()
    expect(formatStateAtCaret(engine.getDelta(), 1).list).toBeNull()
    expect(formatStateAtCaret(engine.getDelta(), 4).list).toBeNull()
  })

  it('continues a list and resets a heading on Enter', () => {
    const engine = new FakeEngine('One')
    engine.setMarkValue(0, 3, 'paragraph', 'h1')
    engine.setMarkValue(0, 3, 'list', 'ol')
    engine.setMarkValue(0, 3, 'align', 'center')

    const result = insertParagraphAt(engine, 3, {
      ...EMPTY_FORMAT_STATE,
      paragraph: 'h1',
      list: 'ol',
      align: 'center',
    })

    expect(result.caret).toBe(4)
    expect(result.format).toMatchObject({
      paragraph: 'normal',
      list: 'ol',
      align: 'center',
    })
    expect(formatStateAtCaret(engine.getDelta(), 4)).toMatchObject({
      paragraph: 'normal',
      list: 'ol',
      align: 'center',
    })
  })

  it('ends a list when Enter is pressed on an empty item', () => {
    const engine = new FakeEngine('One\n')
    engine.setMarkValue(3, 4, 'list', 'ol')
    engine.setMarkValue(3, 4, 'list_level', '0')

    const result = insertParagraphAt(engine, 4, { ...EMPTY_FORMAT_STATE })

    expect(result.caret).toBe(4)
    expect(engine.getText()).toBe('One\n')
    expect(formatStateAtCaret(engine.getDelta(), 4).list).toBeNull()
  })

  it('outdents before ending a nested empty list item', () => {
    const engine = new FakeEngine('One\n')
    engine.setMarkValue(3, 4, 'list', 'ol')
    engine.setMarkValue(3, 4, 'list_level', '2')

    const result = insertParagraphAt(engine, 4, { ...EMPTY_FORMAT_STATE })

    expect(result.caret).toBe(4)
    expect(result.format).toMatchObject({ list: 'ol', listLevel: 1 })
    expect(formatStateAtCaret(engine.getDelta(), 4)).toMatchObject({
      list: 'ol',
      listLevel: 1,
    })
  })

  it('nests and outdents list levels', () => {
    const engine = new FakeEngine('One')
    toggleListRange(engine, 0, 3, 'ul')
    changeListLevelRange(engine, 0, 3, 1)
    expect(formatStateAtCaret(engine.getDelta(), 1).listLevel).toBe(1)

    changeListLevelRange(engine, 0, 3, -1)
    expect(formatStateAtCaret(engine.getDelta(), 1).listLevel).toBe(0)

    changeListLevelRange(engine, 0, 3, -1)
    expect(formatStateAtCaret(engine.getDelta(), 1).list).toBeNull()
  })

  it('inserts styled clipboard characters with marks intact', () => {
    const engine = new FakeEngine('')
    insertStyledChars(engine, 0, [
      { char: 'B', style: { bold: true } },
      { char: 'o', style: { bold: true } },
      { char: 'l', style: { bold: true } },
      { char: 'd', style: { bold: true } },
      { char: ' ', style: { bold: false } },
      { char: 'x', style: {} },
    ])

    expect(engine.getText()).toBe('Bold x')
    expect(formatStateAtCaret(engine.getDelta(), 1).bold).toBe(true)
    expect(formatStateAtCaret(engine.getDelta(), 5).bold).toBe(false)
  })

  it('applies alignment to every selected paragraph', () => {
    const engine = new FakeEngine('One\nTwo')
    setAlignmentRange(engine, 0, 7, 'right')

    expect(formatStateAtCaret(engine.getDelta(), 1).align).toBe('right')
    expect(formatStateAtCaret(engine.getDelta(), 4).align).toBe('right')
  })
})
