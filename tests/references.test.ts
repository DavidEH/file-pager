import { describe, expect, test } from 'claude-code/testing'

import { MAXIMUM_REFERENCES, findReferences, parseReference } from '../hooks/references'

describe('parseReference', () => {
  test('reads a single line', () => {
    expect(parseReference('src/app.ts:42')).toEqual({ path: 'src/app.ts', startLine: 42, endLine: 42 })
  })

  test('reads a range written with a hyphen or an en dash', () => {
    expect(parseReference('src/app.ts:12-30')).toEqual({ path: 'src/app.ts', startLine: 12, endLine: 30 })
    expect(parseReference('src/app.ts:12–30')).toEqual({ path: 'src/app.ts', startLine: 12, endLine: 30 })
  })

  test('reads a line and column as the line', () => {
    expect(parseReference('src/app.ts:42:7')).toEqual({ path: 'src/app.ts', startLine: 42, endLine: 42 })
  })

  test('reads GitHub-style anchors', () => {
    expect(parseReference('src/app.ts#L12-L30')).toEqual({ path: 'src/app.ts', startLine: 12, endLine: 30 })
    expect(parseReference('src/app.ts#L5')).toEqual({ path: 'src/app.ts', startLine: 5, endLine: 5 })
  })

  test('reads a range written backwards as the same region', () => {
    expect(parseReference('app.ts:30-12')).toEqual({ path: 'app.ts', startLine: 12, endLine: 30 })
  })

  test('keeps spaces inside a path', () => {
    const reference = parseReference('backlog/decisions/decision-1 - Config.md:3-9')

    expect(reference).toEqual({ path: 'backlog/decisions/decision-1 - Config.md', startLine: 3, endLine: 9 })
  })

  test('refuses what is no file reference', () => {
    expect(parseReference('src/app.ts')).toBeUndefined()
    expect(parseReference('https://example.com/page.html:8080')).toBeUndefined()
    expect(parseReference('ratio 3:4')).toBeUndefined()
    expect(parseReference('localhost:3000')).toBeUndefined()
  })
})

describe('findReferences', () => {
  test('finds references in code spans, links and prose, in the order written', () => {
    const reply = [
      'The loader is in `src/load.ts:12-30`, and see [db.ts](lib/db.ts:88) for the query.',
      'Also check src/config.py:5, which sets it.',
    ].join('\n')

    expect(findReferences(reply)).toEqual([
      { path: 'src/load.ts', startLine: 12, endLine: 30 },
      { path: 'lib/db.ts', startLine: 88, endLine: 88 },
      { path: 'src/config.py', startLine: 5, endLine: 5 },
    ])
  })

  test('finds a path with spaces when it is in a code span', () => {
    const reply = 'Look at `backlog/decisions/decision-1 - Config.md:3-9` first.'

    expect(findReferences(reply)).toEqual([
      { path: 'backlog/decisions/decision-1 - Config.md', startLine: 3, endLine: 9 },
    ])
  })

  test('strips wrapping punctuation from a bare reference', () => {
    expect(findReferences('(see src/app.ts:42).')).toEqual([{ path: 'src/app.ts', startLine: 42, endLine: 42 }])
  })

  test('lists each region once', () => {
    const reply = '`src/app.ts:4-6` is the bug; src/app.ts:4-6 again, and src/app.ts:4 differs.'

    expect(findReferences(reply)).toEqual([
      { path: 'src/app.ts', startLine: 4, endLine: 6 },
      { path: 'src/app.ts', startLine: 4, endLine: 4 },
    ])
  })

  test('keeps at most MAXIMUM_REFERENCES', () => {
    const reply = Array.from({ length: 30 }, (_, index) => `src/app.ts:${index + 1}`).join(' ')

    expect(findReferences(reply)).toHaveLength(MAXIMUM_REFERENCES)
  })

  test('finds nothing in a reply without references', () => {
    expect(findReferences('All done; the tests pass.')).toEqual([])
  })
})
