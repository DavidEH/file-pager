/**
 * The window's arithmetic: which lines the pane shows and where the cursor
 * stands among them. Nothing here touches the engine.
 */

import type { PagerView } from '../types'

import { LINES_ABOVE_TARGET } from './constants'

/**
 * Keeps the window's first line where the window still fills with lines,
 * never past the point where rows would stand empty below the file's end.
 * @param top the first line wanted, 0-based
 * @param lineCount the file's lines
 * @param room the lines the window shows
 * @returns the first line, 0-based
 */
export function clampTop(top: number, lineCount: number, room: number): number {
  const highestTop = lineCount - room
  const lowerTop = Math.min(top, highestTop)

  return Math.max(0, lowerTop)
}

/**
 * Keeps the cursor on a line of the file.
 * @param cursor the line wanted, 0-based
 * @param lineCount the file's lines
 * @returns the line, 0-based; 0 for an empty file
 */
export function clampCursor(cursor: number, lineCount: number): number {
  const lastLine = lineCount - 1
  const lowerCursor = Math.min(cursor, lastLine)

  return Math.max(0, lowerCursor)
}

/**
 * Scrolls the window the least it takes for the cursor to show, as an editor
 * does when the cursor walks past an edge.
 * @param top the window's first line now
 * @param cursor the cursor's line, already clamped to the file
 * @param lineCount the file's lines
 * @param room the lines the window shows
 * @returns the window's new first line
 */
export function keepCursorInView(top: number, cursor: number, lineCount: number, room: number): number {
  const isAboveWindow = cursor < top
  if (isAboveWindow) {
    return clampTop(cursor, lineCount, room)
  }

  const isBelowWindow = cursor >= top + room
  if (isBelowWindow) {
    return clampTop(cursor - room + 1, lineCount, room)
  }

  return clampTop(top, lineCount, room)
}

/**
 * Puts the cursor on a line with LINES_ABOVE_TARGET lines showing above it,
 * as a `/view <path>:<line>` or a search lands.
 * @param currentView the view now
 * @param line the line to land on, 0-based
 * @param lineCount the file's lines
 * @param room the lines the window shows
 * @returns the view with the cursor and the window moved
 */
export function landOn(currentView: PagerView, line: number, lineCount: number, room: number): PagerView {
  const cursor = clampCursor(line, lineCount)
  const wantedTop = Math.max(0, cursor - LINES_ABOVE_TARGET)
  const top = keepCursorInView(wantedTop, cursor, lineCount, room)

  return { ...currentView, cursor, top, message: '' }
}
