import { describe, expect, test } from 'claude-code/testing'

import { parseShowInput } from '../hooks/show-tool'

describe('parseShowInput', () => {
  test('fills in the defaults: pinned, keyboard left with the prompt', () => {
    expect(parseShowInput({ path: ' notes.md ' })).toEqual({
      path: 'notes.md',
      line: undefined,
      endLine: undefined,
      view: undefined,
      isPinned: true,
      shouldFocus: false,
    })
  })

  test('reads every option', () => {
    const request = parseShowInput({ path: 'a.md', line: 3, endLine: 9, view: 'source', pin: false, focus: true })
    expect(request).toEqual({ path: 'a.md', line: 3, endLine: 9, view: 'source', isPinned: false, shouldFocus: true })
  })

  test('drops line numbers that are not whole and positive, and unknown views', () => {
    const request = parseShowInput({ path: 'a.md', line: 0, view: 'fancy' })
    expect(request).toMatchObject({ line: undefined, view: undefined })
  })

  test('refuses a missing path, an end without a start, and no object', () => {
    expect(parseShowInput({})).toEqual({ error: 'path is required: the file to show.' })
    expect(parseShowInput({ path: 'a.md', endLine: 4 })).toEqual({ error: 'endLine needs line: the region starts at line.' })
    expect(parseShowInput('a.md')).toEqual({ error: 'The input must be an object holding path.' })
  })
})
