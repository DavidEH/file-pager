import { expect, test } from 'claude-code/testing'

import { FRESH_FOCUS_TRACKER, observeDrawing, wasFocusLostToSearch } from '../hooks/focus'

const FOCUSED_DRAWING = { now: 1000, size: 'dock 80x20', isFocused: true }

test('the first drawing only records what it sees', () => {
  const decision = observeDrawing(FRESH_FOCUS_TRACKER, FOCUSED_DRAWING)

  expect(decision.shouldReclaimFocus).toBe(false)
  expect(decision.tracker).toEqual({ lastSize: 'dock 80x20', wasFocused: true, resizedAt: 0, lostFocusAt: 0 })
})

test('a resize that takes the keyboard away asks for it back, once', () => {
  const firstDecision = observeDrawing(FRESH_FOCUS_TRACKER, FOCUSED_DRAWING)

  const resizedDecision = observeDrawing(firstDecision.tracker, { now: 1200, size: 'dock 100x20', isFocused: false })
  expect(resizedDecision.shouldReclaimFocus).toBe(true)

  // The pair is spent: the next unfocused drawing does not ask again.
  const laterDecision = observeDrawing(resizedDecision.tracker, { now: 1300, size: 'dock 100x20', isFocused: false })
  expect(laterDecision.shouldReclaimFocus).toBe(false)
})

test('giving the keyboard away without a resize leaves it with the prompt', () => {
  const firstDecision = observeDrawing(FRESH_FOCUS_TRACKER, FOCUSED_DRAWING)

  const unfocusedDecision = observeDrawing(firstDecision.tracker, { now: 1200, size: 'dock 80x20', isFocused: false })

  expect(unfocusedDecision.shouldReclaimFocus).toBe(false)
})

test('a resize long after the keyboard left does not count', () => {
  const firstDecision = observeDrawing(FRESH_FOCUS_TRACKER, FOCUSED_DRAWING)
  const unfocusedDecision = observeDrawing(firstDecision.tracker, { now: 1200, size: 'dock 80x20', isFocused: false })

  const lateResizeDecision = observeDrawing(unfocusedDecision.tracker, {
    now: 9000,
    size: 'dock 100x20',
    isFocused: false,
  })

  expect(lateResizeDecision.shouldReclaimFocus).toBe(false)
})

test('an unfocused drawing soon after a search asks for the keyboard back', () => {
  expect(wasFocusLostToSearch(1000, 1200, false)).toBe(true)
})

test('a focused drawing after a search asks for nothing', () => {
  expect(wasFocusLostToSearch(1000, 1200, true)).toBe(false)
})

test('with no search pending, or one long past, the prompt keeps the keyboard', () => {
  expect(wasFocusLostToSearch(0, 1200, false)).toBe(false)
  expect(wasFocusLostToSearch(1000, 9000, false)).toBe(false)
})
