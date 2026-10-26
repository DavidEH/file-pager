import { describe, expect, test } from 'claude-code/testing'

import {
  applySearch,
  goToLine,
  jumpToMatch,
  moveCursorBy,
  pageBy,
  scrollBy,
  shiftColumns,
} from '../hooks/moves'
import { CLOSED_VIEW } from '../hooks/state'

const LINES = Array.from({ length: 100 }, (_unused, index) => `line ${index + 1}${index === 41 ? ' needle' : ''}`)
const SIZE = { lineCount: LINES.length, room: 20 }
const OPEN_VIEW = { ...CLOSED_VIEW, path: 'notes.md' }

describe('moveCursorBy', () => {
  test('moves the cursor and keeps the window until the cursor leaves it', () => {
    const movedView = moveCursorBy(OPEN_VIEW, 3, SIZE)

    expect(movedView.cursor).toBe(3)
    expect(movedView.top).toBe(0)
  })

  test('drags the window once the cursor walks past its bottom', () => {
    const movedView = moveCursorBy({ ...OPEN_VIEW, cursor: 19 }, 1, SIZE)

    expect(movedView.cursor).toBe(20)
    expect(movedView.top).toBe(1)
  })

  test('clears a notice', () => {
    expect(moveCursorBy({ ...OPEN_VIEW, message: 'old' }, 1, SIZE).message).toBe('')
  })
})

describe('pageBy', () => {
  test('moves the window and the cursor together', () => {
    const pagedView = pageBy({ ...OPEN_VIEW, cursor: 2 }, 20, SIZE)

    expect(pagedView.top).toBe(20)
    expect(pagedView.cursor).toBe(22)
  })

  test('carries the cursor on to the end at the bottom of the file', () => {
    const pagedView = pageBy({ ...OPEN_VIEW, top: 80, cursor: 85 }, 20, SIZE)

    expect(pagedView.top).toBe(80)
    expect(pagedView.cursor).toBe(99)
  })
})

describe('goToLine and shiftColumns', () => {
  test('goToLine puts the cursor on the line, the window following', () => {
    const endView = goToLine(OPEN_VIEW, 99, SIZE)

    expect(endView.cursor).toBe(99)
    expect(endView.top).toBe(80)
  })

  test('shiftColumns never shifts left of the first column', () => {
    expect(shiftColumns(OPEN_VIEW, 40).left).toBe(40)
    expect(shiftColumns({ ...OPEN_VIEW, left: 10 }, -40).left).toBe(0)
  })
})

describe('scrollBy', () => {
  test('an arrow key moves the cursor', () => {
    const scrolledView = scrollBy(OPEN_VIEW, { rowAmount: 1, bodyRows: 24, isPointer: false }, SIZE)

    expect(scrolledView.cursor).toBe(1)
    expect(scrolledView.top).toBe(0)
  })

  test('the wheel moves the window and keeps the cursor inside it', () => {
    const scrolledView = scrollBy(OPEN_VIEW, { rowAmount: 3, bodyRows: 24, isPointer: true }, SIZE)

    expect(scrolledView.top).toBe(3)
    expect(scrolledView.cursor).toBe(3)
  })

  test('a page key pages by the window, not by the body rows the engine counts', () => {
    const scrolledView = scrollBy(OPEN_VIEW, { rowAmount: 24, bodyRows: 24, isPointer: false }, SIZE)

    expect(scrolledView.top).toBe(20)
    expect(scrolledView.cursor).toBe(20)
  })
})

describe('search', () => {
  test('applySearch lands on the first match from the cursor on and closes the field', () => {
    const searchedView = applySearch({ ...OPEN_VIEW, isSearching: true }, LINES, 20, 'needle')

    expect(searchedView.cursor).toBe(41)
    expect(searchedView.query).toBe('needle')
    expect(searchedView.isSearching).toBe(false)
  })

  test('applySearch says so when nothing matches', () => {
    const searchedView = applySearch(OPEN_VIEW, LINES, 20, 'missing')

    expect(searchedView.cursor).toBe(0)
    expect(searchedView.message).toBe('Pattern not found: missing')
  })

  test('an empty pattern clears the search', () => {
    const clearedView = applySearch({ ...OPEN_VIEW, query: 'old', isSearching: true }, LINES, 20, '')

    expect(clearedView.query).toBe('')
    expect(clearedView.isSearching).toBe(false)
  })

  test('jumpToMatch asks for a pattern when there is none', () => {
    expect(jumpToMatch(OPEN_VIEW, LINES, 20, 1).message).toBe('No search pattern: press s to search')
  })

  test('jumpToMatch finds the next and the previous match without wrapping', () => {
    const searchingView = { ...OPEN_VIEW, query: 'line 5' }

    expect(jumpToMatch(searchingView, LINES, 20, 1).cursor).toBe(4)
    expect(jumpToMatch({ ...searchingView, cursor: 60 }, LINES, 20, -1).cursor).toBe(58)
    expect(jumpToMatch({ ...searchingView, cursor: 99 }, LINES, 20, 1).message).toBe('Pattern not found: line 5')
  })
})
