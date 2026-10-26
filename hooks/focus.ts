/**
 * Telling a focus lost to a resize from one the person gave away. A resize
 * re-seats the pane and the keyboard goes back to the prompt, so the pane
 * asks for it again when a resize and a lost focus land together. Nothing
 * here touches the engine.
 */

import { RESIZE_FOCUS_WINDOW_MILLISECONDS } from './constants'

/** What the drawings saw so far, to compare the next one against. */
export type FocusTracker = {
  /** The pane's size as the last drawing saw it; undefined before the first. */
  lastSize: string | undefined
  /** Whether the pane held the keyboard at the last drawing. */
  wasFocused: boolean
  /** When the pane last changed size, in milliseconds; 0 for not since the last reclaim. */
  resizedAt: number
  /** When the pane last lost the keyboard, in milliseconds; 0 for not since the last reclaim. */
  lostFocusAt: number
}

/** A tracker that has seen no drawing yet. */
export const FRESH_FOCUS_TRACKER: FocusTracker = {
  lastSize: undefined,
  wasFocused: false,
  resizedAt: 0,
  lostFocusAt: 0,
}

/** What one drawing tells the tracker. */
export type DrawingObservation = {
  /** The clock's time at the drawing, in milliseconds. */
  now: number
  /** The pane's and the terminal's size, as one comparable text. */
  size: string
  /** Whether the pane holds the keyboard now. */
  isFocused: boolean
}

/** The tracker after a drawing, and whether the pane should ask for the keyboard back. */
export type FocusDecision = {
  tracker: FocusTracker
  shouldReclaimFocus: boolean
}

/**
 * Notes one drawing and decides whether the keyboard was lost to a resize.
 * @param tracker what the earlier drawings saw
 * @param observation what this drawing sees
 * @returns the updated tracker, and true when the pane should ask for the keyboard back
 */
export function observeDrawing(tracker: FocusTracker, observation: DrawingObservation): FocusDecision {
  const hasEarlierSize = tracker.lastSize !== undefined
  const hasResized = hasEarlierSize && observation.size !== tracker.lastSize
  const hasLostFocus = tracker.wasFocused && !observation.isFocused

  const updatedTracker: FocusTracker = {
    lastSize: observation.size,
    wasFocused: observation.isFocused,
    resizedAt: hasResized ? observation.now : tracker.resizedAt,
    lostFocusAt: hasLostFocus ? observation.now : tracker.lostFocusAt,
  }

  const hasBothEvents = updatedTracker.resizedAt > 0 && updatedTracker.lostFocusAt > 0
  const timeBetweenEvents = Math.abs(updatedTracker.resizedAt - updatedTracker.lostFocusAt)
  const landedTogether = hasBothEvents && timeBetweenEvents <= RESIZE_FOCUS_WINDOW_MILLISECONDS
  const shouldReclaimFocus = !observation.isFocused && landedTogether
  if (!shouldReclaimFocus) {
    return { tracker: updatedTracker, shouldReclaimFocus: false }
  }

  // Once reclaimed, the pair is spent: the next reclaim needs a new pair.
  const spentTracker = { ...updatedTracker, resizedAt: 0, lostFocusAt: 0 }

  return { tracker: spentTracker, shouldReclaimFocus: true }
}

/**
 * Tells whether the keyboard was lost to a submitted search. Enter hides the
 * search field, the element that held the keyboard, and the engine can then
 * hand the keyboard back to the prompt; a drawing soon after the submit that
 * finds the pane unfocused asks for it back.
 * @param searchSubmittedAt when the last search was submitted, in milliseconds; 0 for none pending
 * @param now the clock's time at the drawing, in milliseconds
 * @param isFocused whether the pane holds the keyboard now
 * @returns true when the pane should ask for the keyboard back
 */
export function wasFocusLostToSearch(searchSubmittedAt: number, now: number, isFocused: boolean): boolean {
  const isSearchPending = searchSubmittedAt > 0
  const timeSinceSubmit = now - searchSubmittedAt
  const isRecent = timeSinceSubmit <= RESIZE_FOCUS_WINDOW_MILLISECONDS
  const isRecentSearch = isSearchPending && isRecent

  return isRecentSearch && !isFocused
}
