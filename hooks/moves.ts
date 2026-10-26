/**
 * Every way the pager's view moves, each a pure step from one view to the
 * next: the keys, the engine's scroll, and search. Nothing here touches the
 * engine; the callers store what these return.
 */

import type { PagerView } from '../types'

import { findMatch } from './search'
import { clampCursor, clampTop, keepCursorInView, landOn } from './window'

/** The file's size and the window's height, which every move is held to. */
export type WindowSize = {
  /** The file's lines. */
  lineCount: number
  /** The lines the window shows. */
  room: number
}

/**
 * Moves the cursor by some lines; the window follows it at the edges.
 * @param currentView the view now
 * @param lineAmount lines to move, negative for up
 * @param size the file's lines and the window's height
 * @returns the moved view
 */
export function moveCursorBy(currentView: PagerView, lineAmount: number, size: WindowSize): PagerView {
  const cursor = clampCursor(currentView.cursor + lineAmount, size.lineCount)
  const top = keepCursorInView(currentView.top, cursor, size.lineCount, size.room)

  return { ...currentView, cursor, top, message: '' }
}

/**
 * Moves the window and the cursor together, so the cursor keeps its row on
 * screen; at either end of the file the cursor goes on to the end.
 * @param currentView the view now
 * @param lineAmount lines to move, negative for up
 * @param size the file's lines and the window's height
 * @returns the moved view
 */
export function pageBy(currentView: PagerView, lineAmount: number, size: WindowSize): PagerView {
  const cursor = clampCursor(currentView.cursor + lineAmount, size.lineCount)
  const pagedTop = clampTop(currentView.top + lineAmount, size.lineCount, size.room)
  const top = keepCursorInView(pagedTop, cursor, size.lineCount, size.room)

  return { ...currentView, cursor, top, message: '' }
}

/**
 * Puts the cursor on a line; the window follows it.
 * @param currentView the view now
 * @param line the line, 0-based
 * @param size the file's lines and the window's height
 * @returns the moved view
 */
export function goToLine(currentView: PagerView, line: number, size: WindowSize): PagerView {
  const cursor = clampCursor(line, size.lineCount)
  const top = keepCursorInView(currentView.top, cursor, size.lineCount, size.room)

  return { ...currentView, cursor, top, message: '' }
}

/**
 * Shifts the lines sideways, never left of their first column.
 * @param currentView the view now
 * @param columnAmount columns to shift, negative for left
 * @returns the shifted view
 */
export function shiftColumns(currentView: PagerView, columnAmount: number): PagerView {
  const left = Math.max(0, currentView.left + columnAmount)

  return { ...currentView, left, message: '' }
}

/** One scroll the engine asked for, as the scroll hook reads it. */
export type ScrollRequest = {
  /** Rows asked for, negative for up. */
  rowAmount: number
  /** The body's rows as the engine counts them. */
  bodyRows: number
  /** True for the mouse wheel, false for the arrow and page keys. */
  isPointer: boolean
}

/**
 * Replays the engine's scroll as a move. A page key asks for a whole body,
 * Home and End for the whole tree; both are at least the body's height, so
 * both page here. The wheel and the page keys move the window and drag the
 * cursor along; the arrow keys move the cursor, and the window follows.
 * @param currentView the view now
 * @param request the scroll asked for
 * @param size the file's lines and the window's height
 * @returns the moved view
 */
export function scrollBy(currentView: PagerView, request: ScrollRequest, size: WindowSize): PagerView {
  const isPage = Math.abs(request.rowAmount) >= request.bodyRows
  const lineAmount = isPage ? Math.sign(request.rowAmount) * size.room : request.rowAmount

  const movesWindow = request.isPointer || isPage
  if (!movesWindow) {
    return moveCursorBy(currentView, lineAmount, size)
  }

  const top = clampTop(currentView.top + lineAmount, size.lineCount, size.room)
  const lastShownLine = top + size.room - 1
  const cursorInsideWindow = Math.min(Math.max(currentView.cursor, top), lastShownLine)
  const draggedCursor = isPage ? currentView.cursor + lineAmount : cursorInsideWindow
  const cursor = clampCursor(draggedCursor, size.lineCount)
  const keptTop = keepCursorInView(top, cursor, size.lineCount, size.room)

  return { ...currentView, cursor, top: keptTop, message: '' }
}

/**
 * Lands on the next or the previous line holding the stored pattern.
 * @param currentView the view now, its `query` the pattern
 * @param lines the file's lines
 * @param room the lines the window shows
 * @param step 1 for the next match, -1 for the previous one
 * @returns the moved view, or the view with a notice when there is no match
 */
export function jumpToMatch(currentView: PagerView, lines: string[], room: number, step: 1 | -1): PagerView {
  if (!currentView.query) {
    return { ...currentView, message: 'No search pattern: press s to search' }
  }

  const matchIndex = findMatch(lines, currentView.query, currentView.cursor + step, step)
  if (matchIndex === -1) {
    return { ...currentView, message: `Pattern not found: ${currentView.query}` }
  }

  return landOn(currentView, matchIndex, lines.length, room)
}

/**
 * Applies a submitted search: stores the pattern and lands on its first
 * match from the cursor's own line on; an empty pattern clears the search.
 * @param currentView the view now
 * @param lines the file's lines
 * @param room the lines the window shows
 * @param query the pattern submitted
 * @returns the view with the search applied and the field closed
 */
export function applySearch(currentView: PagerView, lines: string[], room: number, query: string): PagerView {
  if (!query) {
    return { ...currentView, query: '', isSearching: false, message: '' }
  }

  // The cursor's own line counts, so a match under the cursor is found.
  const matchIndex = findMatch(lines, query, currentView.cursor, 1)
  if (matchIndex === -1) {
    return { ...currentView, query, isSearching: false, message: `Pattern not found: ${query}` }
  }

  const landedView = landOn(currentView, matchIndex, lines.length, room)

  return { ...landedView, query, isSearching: false }
}
