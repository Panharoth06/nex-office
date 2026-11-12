import type { ListType, StyledChar, TextStyle } from './textLayout'

/**
 * Parse basic HTML clipboard content.
 *
 * This covers the structures produced by Docs-like editors: paragraphs,
 * headings, lists, line breaks, and inline bold/italic/underline. Unknown
 * stylistic details are ignored rather than failing the paste.
 */
export function styledCharsFromHtml(html: string): StyledChar[] {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const chars: StyledChar[] = []

  const append = (text: string, style: TextStyle) => {
    for (const char of Array.from(text)) chars.push({ char, style })
  }

  const ensureBreak = () => {
    if (chars.length > 0 && chars[chars.length - 1].char !== '\n') {
      chars.push({ char: '\n', style: chars[chars.length - 1].style })
    }
  }

  const parseNode = (
    node: Node,
    inherited: TextStyle,
    list?: { type: ListType; level: number },
  ) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? ''
      if (!raw) return
      const normalized = raw.replace(/\s+/g, ' ')
      if (!normalized.trim()) {
        if (
          normalized.includes(' ') &&
          chars.length > 0 &&
          chars[chars.length - 1].char !== '\n' &&
          chars[chars.length - 1].char !== ' '
        ) {
          append(' ', inherited)
        }
        return
      }
      append(normalized, inherited)
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as HTMLElement
    const tag = element.tagName
    const style = inlineStyle(element, inherited)

    if (tag === 'BR') {
      append('\n', style)
      return
    }

    if (tag === 'UL' || tag === 'OL') {
      ensureBreak()
      const type: ListType = tag === 'OL' ? 'ol' : 'ul'
      const level = list ? list.level + 1 : 0
      for (const child of Array.from(element.children)) {
        if (child.tagName === 'LI') parseNode(child, style, { type, level })
      }
      ensureBreak()
      return
    }

    if (tag === 'LI') {
      const itemStyle: TextStyle = list
        ? { ...style, list: list.type, listLevel: list.level }
        : style
      for (const child of Array.from(element.childNodes)) {
        parseNode(child, itemStyle, list)
      }
      ensureBreak()
      return
    }

    if (isBlockTag(tag)) {
      const blockStyle = blockStyleFromElement(element, style)
      ensureBreak()
      for (const child of Array.from(element.childNodes)) {
        parseNode(child, blockStyle, list)
      }
      ensureBreak()
      return
    }

    for (const child of Array.from(element.childNodes)) {
      parseNode(child, style, list)
    }
  }

  for (const child of Array.from(doc.body.childNodes)) {
    parseNode(child, {})
  }

  while (chars[0]?.char === '\n') chars.shift()
  while (chars[chars.length - 1]?.char === '\n') chars.pop()
  return chars
}

function inlineStyle(element: HTMLElement, inherited: TextStyle): TextStyle {
  const tag = element.tagName
  const weight = element.style.fontWeight
  const decoration = `${element.style.textDecoration} ${element.style.textDecorationLine}`
  return {
    ...inherited,
    bold:
      inherited.bold ||
      tag === 'B' ||
      tag === 'STRONG' ||
      weight === 'bold' ||
      (Number.parseInt(weight, 10) || 0) >= 600,
    italic:
      inherited.italic ||
      tag === 'I' ||
      tag === 'EM' ||
      element.style.fontStyle === 'italic',
    underline:
      inherited.underline || tag === 'U' || decoration.includes('underline'),
  }
}

function blockStyleFromElement(
  element: HTMLElement,
  inherited: TextStyle,
): TextStyle {
  const tag = element.tagName
  const style: TextStyle = { ...inherited }
  if (tag === 'H1') style.paragraph = 'h1'
  else if (tag === 'H2') style.paragraph = 'h2'
  else if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
    style.paragraph = 'h3'
  } else {
    style.paragraph = 'normal'
  }

  const align = element.style.textAlign || element.getAttribute('align') || ''
  if (align === 'center' || align === 'right') {
    style.align = align
  } else {
    style.align = 'left'
  }
  return style
}

function isBlockTag(tag: string): boolean {
  return (
    tag === 'P' ||
    tag === 'DIV' ||
    tag === 'H1' ||
    tag === 'H2' ||
    tag === 'H3' ||
    tag === 'H4' ||
    tag === 'H5' ||
    tag === 'H6' ||
    tag === 'BLOCKQUOTE' ||
    tag === 'PRE'
  )
}

