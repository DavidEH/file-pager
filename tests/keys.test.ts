import { expect, test } from 'claude-code/testing'

import { keyWidth, layoutKeys } from '../hooks/keys'
import type { PagerKey } from '../hooks/keys'

/**
 * Makes a key hint that does nothing when pressed.
 * @param hotkey the key
 * @param label its label
 */
function key(hotkey: string, label: string): PagerKey {
  return { hotkey, label, run: async () => undefined }
}

test('a key hint is as wide as "<hotkey>: <label>"', () => {
  expect(keyWidth(key('j', 'down'))).toBe('j: down'.length)
})

test('key hints fill a row, with two columns between them, before starting the next', () => {
  // "j: down" is 7 wide, "k: up" 5: together with the gap, 14 columns.
  const keys = [key('j', 'down'), key('k', 'up'), key('q', 'quit')]

  const rows = layoutKeys(keys, 14)

  expect(rows.map(row => row.map(rowKey => rowKey.hotkey))).toEqual([['j', 'k'], ['q']])
})

test('one hint wider than the pane still gets a row', () => {
  const rows = layoutKeys([key('s', 'a very long label')], 5)

  expect(rows).toHaveLength(1)
})

test('no hints lay out as no rows', () => {
  expect(layoutKeys([], 80)).toEqual([])
})
