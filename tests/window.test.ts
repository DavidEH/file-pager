import { describe, expect, test } from 'claude-code/testing'

import { CLOSED_VIEW } from '../hooks/state'
import { clampCursor, clampTop, keepCursorInView, landOn } from '../hooks/window'

describe('clampTop', () => {
  test('keeps a top that fills the window', () => {
    expect(clampTop(10, 100, 20)).toBe(10)
  })

  test('stops where the last line reaches the window bottom', () => {
    expect(clampTop(95, 100, 20)).toBe(80)
  })

  test('never goes above the first line, even for a short file', () => {
    expect(clampTop(-3, 100, 20)).toBe(0)
    expect(clampTop(5, 10, 20)).toBe(0)
  })
})

describe('clampCursor', () => {
  test('keeps the cursor on a line of the file', () => {
    expect(clampCursor(42, 100)).toBe(42)
    expect(clampCursor(500, 100)).toBe(99)
    expect(clampCursor(-1, 100)).toBe(0)
  })

  test('is 0 for an empty file', () => {
    expect(clampCursor(3, 0)).toBe(0)
  })
})

describe('keepCursorInView', () => {
  test('leaves the window alone while the cursor shows', () => {
    expect(keepCursorInView(10, 15, 100, 20)).toBe(10)
  })

  test('scrolls up to a cursor above the window', () => {
    expect(keepCursorInView(10, 4, 100, 20)).toBe(4)
  })

  test('scrolls down just enough for a cursor below the window', () => {
    expect(keepCursorInView(10, 35, 100, 20)).toBe(16)
  })
})

describe('landOn', () => {
  test('puts five lines above the landed line', () => {
    const landedView = landOn({ ...CLOSED_VIEW, message: 'old notice' }, 41, 100, 20)

    expect(landedView.cursor).toBe(41)
    expect(landedView.top).toBe(36)
    expect(landedView.message).toBe('')
  })

  test('lands near the top without scrolling past the first line', () => {
    expect(landOn(CLOSED_VIEW, 2, 100, 20).top).toBe(0)
  })
})
