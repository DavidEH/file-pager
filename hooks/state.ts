/**
 * What the pager keeps: its view in the session's state, which outlives a
 * reload, and a few values in the module's memory, which a reload empties.
 */

import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { PagerView } from '../types'

import { FRESH_FOCUS_TRACKER } from './focus'
import type { FocusTracker } from './focus'

/** The view while no file is open. */
export const CLOSED_VIEW: PagerView = {
  path: '',
  top: 0,
  cursor: 0,
  left: 0,
  query: '',
  isSearching: false,
  message: '',
  highlightStart: -1,
  highlightEnd: -1,
  references: [],
  referenceIndex: -1,
  isRendered: false,
  isPinned: false,
}

// Change the tag when PagerView's fields change: it declines what an earlier
// version stored, which outlives a reload. The engine lists the values a
// module reads and writes by scanning the file that declares them, so every
// read and write of the view goes through the two functions below.
const pagerView = atom({ plugin: 'file-pager', key: 'view' } as const, CLOSED_VIEW, {
  shape: 'view-4',
})

/**
 * Reads the stored view; while drawing, a later change redraws the pane.
 * @param $ the engine interface
 * @returns the view
 */
export function readView($: EngineInterface): Promise<PagerView> {
  return read($, pagerView)
}

/**
 * Stores the next view, worked out from the current one.
 * @param $ the engine interface
 * @param nextView works out the next view from the current one
 */
export async function changeView($: EngineInterface, nextView: (currentView: PagerView) => PagerView) {
  await update($, pagerView, nextView)
}

/** The pager's values kept in the module's memory between drawings. */
type PagerMemory = {
  /**
   * The open file's lines. They live here, not in session state, so a large
   * file is never copied through the state store; the next drawing after a
   * reload reads the file again.
   */
  loadedFile: { path: string; lines: string[] } | undefined
  /** The lines the last drawing showed, which the scroll hook pages by. */
  drawnRoom: number
  /** The terminal's height as the last drawing saw it, which sizes the pane. */
  terminalRows: number | undefined
  /** What the drawings saw of the pane's size and focus. */
  focusTracker: FocusTracker
  /**
   * When the last search was submitted, in milliseconds, so the next drawing
   * can take the keyboard back if hiding the field lost it; 0 for none pending.
   */
  searchSubmittedAt: number
}

/** The pager's memory, shared by its files. */
export const pagerMemory: PagerMemory = {
  loadedFile: undefined,
  drawnRoom: 1,
  terminalRows: undefined,
  focusTracker: FRESH_FOCUS_TRACKER,
  searchSubmittedAt: 0,
}

/**
 * Forgets what the pager remembered of an open pane, as when it closes. The
 * terminal's height is kept: it still sizes the next pane.
 */
export function forgetOpenPane() {
  pagerMemory.loadedFile = undefined
  pagerMemory.focusTracker = FRESH_FOCUS_TRACKER
  pagerMemory.searchSubmittedAt = 0
}
