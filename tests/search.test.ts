import { describe, expect, test } from 'claude-code/testing'

import { findMatch, isCaseSensitive, lineMatches, splitMatches } from '../hooks/search'

describe('smart case', () => {
  test('a pattern with a capital is exact', () => {
    expect(isCaseSensitive('Needle')).toBe(true)
    expect(isCaseSensitive('needle')).toBe(false)
  })

  test('a lower-case pattern matches any case; one with a capital matches exactly', () => {
    expect(lineMatches('a NEEDLE here', 'needle')).toBe(true)
    expect(lineMatches('a needle here', 'Needle')).toBe(false)
    expect(lineMatches('a Needle here', 'Needle')).toBe(true)
  })
})

describe('findMatch', () => {
  const lines = ['alpha', 'beta', 'gamma', 'beta again']

  test('walks down from the start index, which counts', () => {
    expect(findMatch(lines, 'beta', 0, 1)).toBe(1)
    expect(findMatch(lines, 'beta', 1, 1)).toBe(1)
    expect(findMatch(lines, 'beta', 2, 1)).toBe(3)
  })

  test('walks up', () => {
    expect(findMatch(lines, 'beta', 2, -1)).toBe(1)
  })

  test('does not wrap past either end', () => {
    expect(findMatch(lines, 'alpha', 1, 1)).toBe(-1)
    expect(findMatch(lines, 'again', 2, -1)).toBe(-1)
  })
})

describe('splitMatches', () => {
  test('splits a line into plain and matching runs', () => {
    expect(splitMatches('one needle two needle', 'needle')).toEqual([
      { text: 'one ', isMatch: false },
      { text: 'needle', isMatch: true },
      { text: ' two ', isMatch: false },
      { text: 'needle', isMatch: true },
    ])
  })

  test('keeps the line its own case while matching any case', () => {
    expect(splitMatches('A NEEDLE', 'needle')).toEqual([
      { text: 'A ', isMatch: false },
      { text: 'NEEDLE', isMatch: true },
    ])
  })

  test('an empty pattern is one plain run', () => {
    expect(splitMatches('plain', '')).toEqual([{ text: 'plain', isMatch: false }])
  })
})
