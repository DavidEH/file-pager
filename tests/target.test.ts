import { describe, expect, test } from 'claude-code/testing'

import { baseName, parseTarget, stripMention, unquote } from '../hooks/target'

describe('parseTarget', () => {
  test('reads a path alone', () => {
    expect(parseTarget('docs/notes.md')).toEqual({ path: 'docs/notes.md' })
  })

  test('reads a path with a line', () => {
    expect(parseTarget('docs/notes.md:42')).toEqual({ path: 'docs/notes.md', line: 42 })
  })

  test('reads a path with a range, written forwards or backwards', () => {
    expect(parseTarget('docs/notes.md:20-24')).toEqual({ path: 'docs/notes.md', line: 20, endLine: 24 })
    expect(parseTarget('docs/notes.md:24-20')).toEqual({ path: 'docs/notes.md', line: 20, endLine: 24 })
  })

  test('reads a file picked from the @ mention menu, quoted with spaces', () => {
    expect(parseTarget('@"docs/my notes.md":42')).toEqual({ path: 'docs/my notes.md', line: 42 })
  })

  test('nothing typed is an empty path', () => {
    expect(parseTarget('  ')).toEqual({ path: '' })
  })
})

describe('helpers', () => {
  test('stripMention removes a leading @', () => {
    expect(stripMention(' @docs/notes.md ')).toBe('docs/notes.md')
    expect(stripMention('docs/notes.md')).toBe('docs/notes.md')
  })

  test('unquote removes one pair of matching quotes', () => {
    expect(unquote('"my notes.md"')).toBe('my notes.md')
    expect(unquote("'my notes.md'")).toBe('my notes.md')
    expect(unquote('"unbalanced')).toBe('"unbalanced')
  })

  test('baseName takes the last segment with either separator', () => {
    expect(baseName('docs/specs/design.md')).toBe('design.md')
    expect(baseName('docs\\design.md')).toBe('design.md')
    expect(baseName('README.md')).toBe('README.md')
  })
})
