/**
 * The pager's key hints and how they are laid out in rows. Nothing here
 * touches the engine.
 */

import { KEY_GAP } from './constants'

/** One key hint: the key, its label, and what pressing it does. */
export type PagerKey = {
  hotkey: string
  label: string
  run: () => Promise<unknown>
}

/** The columns a plain Button adds around its label: the `: ` after the hotkey. */
const HOTKEY_SEPARATOR_WIDTH = 2

/**
 * The columns one key hint takes: a plain Button draws as `<hotkey>: <label>`.
 * @param key the key hint
 * @returns its width in columns
 */
export function keyWidth(key: PagerKey): number {
  return key.hotkey.length + HOTKEY_SEPARATOR_WIDTH + key.label.length
}

/**
 * Lays the key hints out in rows that fit the pane, greedily, so the drawing
 * knows exactly how many rows the footer takes before it fills the rest.
 * @param keys the hints in reading order
 * @param columns the cells across the pane's body
 * @returns the hints grouped by row
 */
export function layoutKeys(keys: PagerKey[], columns: number): PagerKey[][] {
  const rows: PagerKey[][] = []
  let currentRow: PagerKey[] = []
  let currentRowWidth = 0

  for (const key of keys) {
    const width = keyWidth(key)
    const isRowEmpty = currentRow.length === 0
    const widthWithKey = isRowEmpty ? width : currentRowWidth + KEY_GAP + width
    const overflowsRow = !isRowEmpty && widthWithKey > columns
    if (overflowsRow) {
      rows.push(currentRow)
      currentRow = []
      currentRowWidth = width
    } else {
      currentRowWidth = widthWithKey
    }

    currentRow.push(key)
  }

  const hasLastRow = currentRow.length > 0
  if (hasLastRow) {
    rows.push(currentRow)
  }

  return rows
}
