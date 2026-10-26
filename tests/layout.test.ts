import { describe, expect, test } from 'claude-code/testing'

import { describeStatus, groupRowRuns, hasRegion, isLineInRegion } from '../hooks/layout'
import { CLOSED_VIEW } from '../hooks/state'

const OPEN_VIEW = { ...CLOSED_VIEW, path: 'notes.md' }

describe('groupRowRuns', () => {
  test('puts the cursor line in a run of its own between the plain runs', () => {
    expect(groupRowRuns(['a', 'b', 'c', 'd'], 1)).toEqual([
      { kind: 'plain', lines: ['a'] },
      { kind: 'cursor', lines: ['b'] },
      { kind: 'plain', lines: ['c', 'd'] },
    ])
  })

  test('a cursor on the first row starts the runs', () => {
    expect(groupRowRuns(['a', 'b'], 0)).toEqual([
      { kind: 'cursor', lines: ['a'] },
      { kind: 'plain', lines: ['b'] },
    ])
  })
})

describe('groupRowRuns with a search pattern', () => {
  test('puts the lines holding a match in runs apart from the coloured rest', () => {
    expect(groupRowRuns(['a', 'needle', 'Needle 2', 'b', 'c needle'], 3, 'needle')).toEqual([
      { kind: 'plain', lines: ['a'] },
      { kind: 'match', lines: ['needle', 'Needle 2'] },
      { kind: 'cursor', lines: ['b'] },
      { kind: 'match', lines: ['c needle'] },
    ])
  })

  test('the cursor line stays its own run even when it holds a match', () => {
    expect(groupRowRuns(['needle', 'b'], 0, 'needle')).toEqual([
      { kind: 'cursor', lines: ['needle'] },
      { kind: 'plain', lines: ['b'] },
    ])
  })

  test('a pattern with a capital matches its case exactly', () => {
    expect(groupRowRuns(['needle', 'Needle'], 5, 'Needle')).toEqual([
      { kind: 'plain', lines: ['needle'] },
      { kind: 'match', lines: ['Needle'] },
    ])
  })
})

describe('regions', () => {
  test('no region while its start is -1', () => {
    expect(hasRegion(OPEN_VIEW)).toBe(false)
    expect(isLineInRegion(OPEN_VIEW, 0)).toBe(false)
  })

  test('a region covers its first and last lines and those between', () => {
    const regionView = { ...OPEN_VIEW, highlightStart: 19, highlightEnd: 23 }

    expect(isLineInRegion(regionView, 18)).toBe(false)
    expect(isLineInRegion(regionView, 19)).toBe(true)
    expect(isLineInRegion(regionView, 23)).toBe(true)
    expect(isLineInRegion(regionView, 24)).toBe(false)
  })
})

describe('describeStatus', () => {
  test('says where the cursor and the window stand', () => {
    const statusText = describeStatus(OPEN_VIEW, { cursor: 0, top: 0, shownEnd: 20, lineCount: 100 })

    expect(statusText).toBe('line 1 of 100  lines 1-20 (20%)')
  })

  test('marks the end, the column, the pattern, the region and the reference', () => {
    const detailedView = {
      ...OPEN_VIEW,
      left: 40,
      query: 'needle',
      highlightStart: 79,
      highlightEnd: 84,
      references: [{ path: 'notes.md', startLine: 80, endLine: 85 }],
      referenceIndex: 0,
    }

    const statusText = describeStatus(detailedView, { cursor: 79, top: 80, shownEnd: 100, lineCount: 100 })

    expect(statusText).toBe('line 80 of 100  lines 81-100 (100%) (END) col 41 /needle  region 80-85 (ref 1 of 1)')
  })

  test('says so for an empty file', () => {
    expect(describeStatus(OPEN_VIEW, { cursor: 0, top: 0, shownEnd: 0, lineCount: 0 })).toBe('empty file (100%) (END)')
  })
})
