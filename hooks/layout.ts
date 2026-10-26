/**
 * The pure parts of the pane's drawing: which rows go together, which lines
 * the region covers, and what the status row says. Nothing here touches the
 * engine.
 */

import type { PagerView } from '../types'

import { lineMatches } from './search'

/**
 * How a run of shown lines is drawn: the cursor's line, a line holding a
 * search match (drawn plain so the match can be marked), or the rest, which
 * keep the syntax colours.
 */
export type RowKind = 'cursor' | 'match' | 'plain'

/** Consecutive shown lines drawn the same way. */
export type RowRun = {
  kind: RowKind
  lines: string[]
}

/**
 * Tells how one shown line is drawn.
 * @param line the line as shown
 * @param row its row in the window, 0-based
 * @param cursorRow the cursor's row, 0-based
 * @param query the search pattern; empty when no search is active
 * @returns the line's kind
 */
function rowKindOf(line: string, row: number, cursorRow: number, query: string): RowKind {
  const isCursorRow = row === cursorRow
  if (isCursorRow) {
    return 'cursor'
  }

  const hasQuery = query.length > 0
  const holdsMatch = hasQuery && lineMatches(line, query)
  if (holdsMatch) {
    return 'match'
  }

  return 'plain'
}

/**
 * Groups the shown lines into runs, so each run can be drawn its own way:
 * the cursor's line in a run of its own, the lines holding a search match
 * in runs apart from the coloured rest.
 * @param shownLines the lines the window shows, in order
 * @param cursorRow the cursor's row among them, 0-based
 * @param query the search pattern; empty when no search is active
 * @returns the runs in order
 */
export function groupRowRuns(shownLines: string[], cursorRow: number, query = ''): RowRun[] {
  const runs: RowRun[] = []
  shownLines.forEach((line, row) => {
    const kind = rowKindOf(line, row, cursorRow, query)

    const lastRun = runs.at(-1)
    const isSameKind = lastRun !== undefined && lastRun.kind === kind
    const continuesRun = isSameKind && kind !== 'cursor'
    if (continuesRun) {
      lastRun.lines.push(line)
    } else {
      runs.push({ kind, lines: [line] })
    }
  })

  return runs
}

/**
 * Tells whether the view highlights a region at all.
 * @param view the view
 * @returns true when a region is highlighted
 */
export function hasRegion(view: PagerView): boolean {
  const hasStart = view.highlightStart >= 0
  const isOrdered = view.highlightEnd >= view.highlightStart

  return hasStart && isOrdered
}

/**
 * Tells whether a file line lies in the highlighted region.
 * @param view the view
 * @param lineIndex the line, 0-based
 * @returns true when the line is highlighted
 */
export function isLineInRegion(view: PagerView, lineIndex: number): boolean {
  const isAfterStart = lineIndex >= view.highlightStart
  const isBeforeEnd = lineIndex <= view.highlightEnd

  return hasRegion(view) && isAfterStart && isBeforeEnd
}

/** Where the window stands, as the status row reports it. */
export type WindowPosition = {
  /** The cursor's line, 0-based. */
  cursor: number
  /** The window's first line, 0-based. */
  top: number
  /** The line after the window's last shown line, 0-based. */
  shownEnd: number
  /** The file's lines. */
  lineCount: number
}

/**
 * The status row's text after the file's name: where the cursor and the
 * window stand, how far through the file the window reaches, and any
 * column shift, search pattern, region and reference.
 * @param view the view
 * @param position where the window stands
 * @returns the text
 */
export function describeStatus(view: PagerView, position: WindowPosition): string {
  const isEmptyFile = position.lineCount === 0
  const cursorText = `line ${position.cursor + 1} of ${position.lineCount}`
  const windowText = `lines ${position.top + 1}-${position.shownEnd}`
  const linesText = `${cursorText}  ${windowText}`
  const positionText = isEmptyFile ? 'empty file' : linesText

  const percent = isEmptyFile ? 100 : Math.round((position.shownEnd / position.lineCount) * 100)
  const isAtEnd = position.shownEnd >= position.lineCount
  const endText = isAtEnd ? ' (END)' : ''

  const columnText = view.left > 0 ? ` col ${view.left + 1}` : ''
  const queryText = view.query ? ` /${view.query}` : ''

  const regionText = hasRegion(view) ? `  region ${view.highlightStart + 1}-${view.highlightEnd + 1}` : ''
  const hasReference = view.referenceIndex >= 0 && view.references.length > 0
  const referenceNumber = view.referenceIndex + 1
  const referenceText = hasReference ? ` (ref ${referenceNumber} of ${view.references.length})` : ''

  return `${positionText} (${percent}%)${endText}${columnText}${queryText}${regionText}${referenceText}`
}
