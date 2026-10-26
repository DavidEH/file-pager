import { describe, expect, test } from 'claude-code/testing'

import { MAXIMUM_RENDERED_CHARACTERS, fitsRendered, isMarkdownPath, shouldOpenRendered } from '../hooks/markdown'

describe('isMarkdownPath', () => {
  test('knows .md and .markdown in any case', () => {
    expect(isMarkdownPath('notes.md')).toBe(true)
    expect(isMarkdownPath('/a/b/NOTES.MD')).toBe(true)
    expect(isMarkdownPath('guide.markdown')).toBe(true)
  })

  test('refuses other files', () => {
    expect(isMarkdownPath('main.py')).toBe(false)
    expect(isMarkdownPath('md')).toBe(false)
    expect(isMarkdownPath('notes.md.bak')).toBe(false)
  })
})

describe('fitsRendered', () => {
  test('counts the newlines between lines', () => {
    const halfLine = 'x'.repeat(MAXIMUM_RENDERED_CHARACTERS / 2)
    // Two halves fill the limit exactly; the newline between them tips it over.
    expect(fitsRendered([halfLine + halfLine])).toBe(true)
    expect(fitsRendered([halfLine, halfLine])).toBe(false)
  })

  test('an empty file fits', () => {
    expect(fitsRendered([])).toBe(true)
  })
})

describe('shouldOpenRendered', () => {
  test('a Markdown file without a line opens rendered', () => {
    expect(shouldOpenRendered('notes.md', undefined, false)).toBe(true)
  })

  test('a line to land on opens the source', () => {
    expect(shouldOpenRendered('notes.md', undefined, true)).toBe(false)
  })

  test('the requested view wins, but only Markdown renders', () => {
    expect(shouldOpenRendered('notes.md', 'source', false)).toBe(false)
    expect(shouldOpenRendered('notes.md', 'rendered', true)).toBe(true)
    expect(shouldOpenRendered('main.py', 'rendered', false)).toBe(false)
  })
})
