#!/usr/bin/env node
/**
 * Reject default native browser widgets in visible UI.
 *
 * Project rule: every visible control must come from
 * `apps/web/components/shared/*` (UiButton, UiTextField, UiSelect, UiMenu,
 * UiModal, UiTooltip). The only allowed native control is the invisible
 * `<textarea>` inside `HiddenInput.vue`, which is required for IME input.
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scanRoots = ['components', 'pages', 'layouts'].map((dir) => join(webRoot, dir))
scanRoots.push(join(webRoot, 'app.vue'), join(webRoot, 'error.vue'))

const textareaAllowlist = new Set(['components/editor/HiddenInput.vue'])

const forbiddenPatterns = [
  { pattern: /<select\b/i, message: 'native <select> is not allowed' },
  { pattern: /<option\b/i, message: 'native <option> is not allowed' },
  { pattern: /<dialog\b/i, message: 'native <dialog> is not allowed' },
  { pattern: /<details\b/i, message: 'native <details> is not allowed' },
  { pattern: /<summary\b/i, message: 'native <summary> is not allowed' },
  {
    pattern:
      /<input\b[^>]*\btype\s*=\s*["'](?:date|time|datetime-local|month|week|color|file|range|checkbox|radio)["']/i,
    message: 'native date/color/file/range/checkbox/radio input is not allowed',
  },
]

function hasNativeTitleAttribute(line) {
  // Only native tags: `<span title="…">`. Component props such as
  // `<EditorToolbar :title="…">` are fine.
  return /<(?:[a-z][a-z0-9-]*|NuxtLink)\b[^>]*\stitle\s*=/i.test(line)
}

async function collect(entry, files = []) {
  try {
    const entries = await readdir(entry, { withFileTypes: true })
    for (const child of entries) {
      const fullPath = join(entry, child.name)
      if (child.isDirectory()) {
        await collect(fullPath, files)
      } else if (extname(child.name) === '.vue') {
        files.push(fullPath)
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') return files
    if (error.code !== 'ENOTDIR') throw error
    if (extname(entry) === '.vue') files.push(entry)
  }
  return files
}

const files = (await Promise.all(scanRoots.map((entry) => collect(entry)))).flat()
const violations = []

for (const file of files) {
  const relativePath = relative(webRoot, file).split('\\').join('/')
  const source = await readFile(file, 'utf8')
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    for (const { pattern, message } of forbiddenPatterns) {
      if (pattern.test(line)) {
        violations.push(`${relativePath}:${index + 1}  ${message}`)
      }
    }

    if (hasNativeTitleAttribute(line)) {
      violations.push(
        `${relativePath}:${index + 1}  native title tooltips are not allowed; use UiTooltip`,
      )
    }

    if (/<textarea\b/i.test(line) && !textareaAllowlist.has(relativePath)) {
      violations.push(
        `${relativePath}:${index + 1}  native <textarea> is not allowed; use UiTextField`,
      )
    }
  })
}

if (violations.length > 0) {
  console.error('Default native browser controls found:\n')
  for (const violation of violations) console.error(`  ${violation}`)
  console.error('\nUse the primitives in apps/web/components/shared/ instead.')
  process.exit(1)
}

console.log(`Custom UI check passed (${files.length} Vue files scanned).`)
