/**
 * Reading what was typed after `/view`. Nothing here touches the engine.
 */

/** The file `/view` was asked to open, and where in it. */
export type ViewTarget = {
  /** The path as typed; empty when nothing was typed. */
  path: string
  /** The 1-based line to land on, when one was given. */
  line?: number
  /** The 1-based last line of a range to highlight, when a range was given. */
  endLine?: number
}

/** A path followed by `:<line>` or `:<first>-<last>` (a hyphen or an en dash). */
const LOCATED_PATH = /^(.+?):(\d+)(?:\s*[-–]\s*(\d+))?$/

/** A text wrapped in one pair of matching quotes. */
const QUOTED_TEXT = /^(["']).*\1$/

/**
 * Removes the `@` that Claude Code's file mention puts before a path, as in
 * `@"docs/my notes.md"` or `@docs/notes.md`.
 * @param text the text as typed
 * @returns the text without a leading `@`, trimmed
 */
export function stripMention(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('@')) {
    return trimmed.slice(1)
  }

  return trimmed
}

/**
 * Removes one pair of matching quotes around a text, after trimming it.
 * @param text the text as typed
 * @returns the text without its surrounding quotes
 */
export function unquote(text: string): string {
  const trimmed = text.trim()
  const isLongEnough = trimmed.length >= 2
  const isQuoted = isLongEnough && QUOTED_TEXT.test(trimmed)
  if (isQuoted) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

/**
 * The last part of a path, as a file name for the pane's tab.
 * @param path the path, with forward or backward separators
 * @returns its last segment, or the path itself when it has none
 */
export function baseName(path: string): string {
  const segments = path.split(/[\\/]/).filter(segment => segment.length > 0)

  return segments.pop() ?? path
}

/**
 * Reads what was typed after `/view` as a path and an optional line number
 * or line range, written `<path>:<line>` or `<path>:<first>-<last>` as
 * compilers and editors print locations. A file picked from the `@` mention
 * menu is read as its plain path.
 * @param argumentsText the command's arguments as typed
 * @returns the path, and the line or range when one was given
 */
export function parseTarget(argumentsText: string): ViewTarget {
  const typedText = unquote(stripMention(argumentsText))
  const located = LOCATED_PATH.exec(typedText)
  const pathPart = located?.[1]
  const linePart = located?.[2]
  const hasLocation = pathPart !== undefined && linePart !== undefined
  if (!hasLocation) {
    return { path: typedText }
  }

  const firstLine = Math.max(1, Number(linePart))
  const endPart = located?.[3]
  if (endPart === undefined) {
    return { path: unquote(pathPart), line: firstLine }
  }

  // A range written backwards, as 30-12, is read as the same region.
  const secondLine = Math.max(1, Number(endPart))
  const startLine = Math.min(firstLine, secondLine)
  const endLine = Math.max(firstLine, secondLine)

  return { path: unquote(pathPart), line: startLine, endLine }
}
