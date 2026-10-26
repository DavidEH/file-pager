/**
 * Opening files in the pager: from a typed `/view`, and from the regions a
 * reply referred to.
 */

import type { EngineInterface } from 'claude-code'

import type { FileReference } from '../types'

import { ASSUMED_TERMINAL_ROWS, EXTRA_ROWS, LINES_ABOVE_TARGET, PANE_ID } from './constants'
import { forgetLoadedLines, readLines } from './file-lines'
import { findReferences } from './references'
import { fitsRendered } from './markdown'
import { CLOSED_VIEW, changeView, forgetOpenPane, pagerMemory, readView } from './state'
import { baseName } from './target'
import { clampCursor } from './window'

/** The share of the terminal's height the pane's default inline height takes. */
const DEFAULT_HEIGHT_DIVISOR = 3

/**
 * Opens the pager pane, asking for EXTRA_ROWS more than the default inline
 * height. Every open sets the height anew, so each one asks. The ask is not a
 * grant: a height the person dragged the pane to wins, and a pane docked
 * beside a fullscreen transcript already takes the full height.
 * @param $ the engine interface
 * @param path the file shown, whose name becomes the pane's tab title
 * @param shouldFocus true to give the pane the keyboard; false leaves it with
 *   the prompt, as when a reply opened the pane rather than the person
 * @returns whether a surface draws the pane now
 */
export function openPane($: EngineInterface, path: string, shouldFocus = true) {
  const terminalRows = pagerMemory.terminalRows ?? ASSUMED_TERMINAL_ROWS
  const defaultRows = Math.floor(terminalRows / DEFAULT_HEIGHT_DIVISOR)
  const rows = defaultRows + EXTRA_ROWS
  const focusRequest = shouldFocus ? { focus: true as const } : {}

  return $.ui.open({ id: PANE_ID, title: baseName(path), rows, ...focusRequest })
}

/**
 * Closes the pager pane from its own quit key. The mod's ui.close hook does
 * not run for a close the mod itself asks for, so the view is cleared here:
 * that also ends a pin, so the next reply's file references show again.
 * @param $ the engine interface
 */
export async function closePane($: EngineInterface) {
  forgetOpenPane()
  await changeView($, () => CLOSED_VIEW)
  await $.ui.close({ id: PANE_ID })
}

/** What to open in the pager, and how. */
export type OpenRequest = {
  /** The file, relative to the session's directory or absolute. */
  path: string
  /** The 1-based line to land on; the top of the file when absent. */
  startLine?: number
  /** The 1-based last line of a region to highlight from startLine; no highlight when absent. */
  endLine?: number
  /** True to give the pane the keyboard. */
  shouldFocus: boolean
  /** The regions a reply referred to, kept for the r and t keys; empty for a typed /view. */
  references: FileReference[]
  /** Which of `references` this is; -1 when none. */
  referenceIndex: number
  /** True to draw a Markdown file rendered; drawn as source when absent or when it is too long. */
  isRendered?: boolean
  /** True to keep a reply's file references from replacing this file; false when absent. */
  isPinned?: boolean
}

/** What opening a file came to. */
export type OpenOutcome = {
  /** The file's line count. */
  lineCount: number
  /** True when a surface draws the pane now. */
  isPlaced: boolean
  /** True when the file is drawn as rendered Markdown. */
  isRendered: boolean
}

/**
 * Reads a file afresh and shows it in the pager, landing on a line and
 * highlighting a region when asked.
 * @param $ the engine interface
 * @param request what to open, and how
 * @returns the file's line count and whether the pane is drawn now
 * @throws when the file cannot be read
 */
export async function openTarget($: EngineInterface, request: OpenRequest): Promise<OpenOutcome> {
  // Opening a file always reads it again, so an edited file shows fresh.
  forgetLoadedLines()
  const lines = await readLines($, request.path)
  const lineCount = lines.length

  // A line past the end lands on the last line. The room is not known until
  // the pane draws, which keeps the cursor in view whatever room it has.
  const hasStartLine = request.startLine !== undefined
  const startLine = request.startLine ?? 1
  const cursor = hasStartLine ? clampCursor(startLine - 1, lineCount) : 0
  const top = Math.max(0, cursor - LINES_ABOVE_TARGET)
  const isPastEnd = hasStartLine && startLine > lineCount
  const message = isPastEnd ? `Line ${startLine} is past the end` : ''

  const hasRegion = hasStartLine && request.endLine !== undefined
  const regionEndLine = request.endLine ?? startLine
  const highlightStart = hasRegion ? cursor : -1
  const highlightEnd = hasRegion ? clampCursor(regionEndLine - 1, lineCount) : -1

  // A file too long for one Markdown drawing falls back to its source.
  const isRenderedRequested = request.isRendered === true
  const isRendered = isRenderedRequested && fitsRendered(lines)
  const isTooLongToRender = isRenderedRequested && !isRendered
  const renderMessage = isTooLongToRender ? 'Too long to render; showing the source' : ''
  const shownMessage = message || renderMessage

  await changeView($, () => ({
    ...CLOSED_VIEW,
    path: request.path,
    top,
    cursor,
    message: shownMessage,
    highlightStart,
    highlightEnd,
    references: request.references,
    referenceIndex: request.referenceIndex,
    isRendered,
    isPinned: request.isPinned === true,
  }))
  const { isPlaced } = await openPane($, request.path, request.shouldFocus)

  return { lineCount, isPlaced, isRendered }
}

/**
 * Keeps an index inside a list's bounds by wrapping it around either end.
 * @param index the index, possibly negative or past the end
 * @param length the list's length, above 0
 * @returns the index wrapped into 0 through length - 1
 */
function wrapIndex(index: number, length: number): number {
  const remainder = index % length

  return (remainder + length) % length
}

/**
 * Shows one of a reply's references in the pager, its region highlighted.
 * When that file cannot be read, the next reference is tried, and so on.
 * @param $ the engine interface
 * @param references the reply's references, all kept for the r and t keys
 * @param firstIndex the reference to try first
 * @param step 1 to try the following ones next, -1 the preceding ones
 * @param shouldFocus true to give the pane the keyboard
 * @returns true when a reference was shown
 */
export async function openReference(
  $: EngineInterface,
  references: FileReference[],
  firstIndex: number,
  step: 1 | -1,
  shouldFocus: boolean,
): Promise<boolean> {
  const referenceCount = references.length
  for (let attempt = 0; attempt < referenceCount; attempt += 1) {
    const referenceIndex = wrapIndex(firstIndex + attempt * step, referenceCount)
    const reference = references[referenceIndex]
    if (reference === undefined) {
      continue
    }

    try {
      await openTarget($, {
        path: reference.path,
        startLine: reference.startLine,
        endLine: reference.endLine,
        shouldFocus,
        references,
        referenceIndex,
      })

      return true
    } catch {
      // A reference to a folder or an unreadable file is passed over.
    }
  }

  return false
}

/**
 * Finds the file regions a reply referred to and shows the first one in the
 * pager, leaving the keyboard with the prompt. A reply that refers to no
 * existing file leaves the pager as it is, and so does any reply while the
 * show tool's file is pinned.
 * @param $ the engine interface
 * @param answer the reply's text
 */
export async function showReferencesFrom($: EngineInterface, answer: string) {
  const currentView = await readView($)
  const isPinnedFileShown = currentView.isPinned && currentView.path !== ''
  if (isPinnedFileShown) {
    return
  }

  const foundReferences = findReferences(answer)
  const existingReferences: FileReference[] = []
  for (const reference of foundReferences) {
    const doesExist = await $.fs.exists(reference.path)
    if (doesExist) {
      existingReferences.push(reference)
    }
  }

  const hasReferences = existingReferences.length > 0
  if (!hasReferences) {
    return
  }

  await openReference($, existingReferences, 0, 1, false)
}
