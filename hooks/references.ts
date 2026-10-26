/**
 * Finds references to regions of files in a text, as Claude writes them in
 * its replies: `src/app.ts:42`, `src/app.ts:12-30`, `src/app.ts:42:7`
 * (line and column) or `src/app.ts#L12-L30`. Nothing here touches the
 * engine; checking that a referenced file exists is the caller's.
 */

import type { FileReference } from '../types'

/** The most references kept from one text. */
export const MAXIMUM_REFERENCES = 20

/**
 * A path followed by a location: `:<line>`, `:<line>-<line>` (a hyphen or
 * an en dash), `:<line>:<column>`, or `#L<line>` and `#L<line>-L<line>`.
 * The whole candidate must match, so a stray colon inside prose does not.
 */
const LOCATED_PATH = /^(.+?)(?::(\d+)(?:\s*[-–]\s*(\d+))?(?::\d+)?|#L(\d+)(?:-L?(\d+))?)$/

/** A URL scheme such as `https://`, which marks a candidate as no file. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/** Inline code spans: `` `src/app.ts:12-30` ``. */
const CODE_SPAN = /`([^`\n]+)`/g

/** Markdown link targets: `[app.ts](src/app.ts:12)`. */
const LINK_TARGET = /\]\(([^)\s]+)\)/g

/** Runs of text without whitespace, for references written bare in prose. */
const BARE_TOKEN = /\S+/g

/** Punctuation that ends a sentence or wraps a bare reference, not part of it. */
const WRAPPING_PUNCTUATION_AT_START = /^[("'[<*_]+/
const WRAPPING_PUNCTUATION_AT_END = /[)"'\]>*_.,;:!?]+$/

/** A candidate reference and where it stood in the text, to keep their order. */
type Candidate = {
  text: string
  position: number
}

/**
 * Reads one candidate as a path and a line range.
 * @param candidateText the text of a code span, a link target or a bare token
 * @returns the reference, or undefined when the text is not one
 */
export function parseReference(candidateText: string): FileReference | undefined {
  const located = LOCATED_PATH.exec(candidateText.trim())
  if (located === null) {
    return undefined
  }

  const path = (located[1] ?? '').replace(/^@/, '').trim()
  const isUrl = URL_SCHEME.test(path)
  const looksLikePath = path.includes('/') || /\.[A-Za-z0-9]+$/.test(path)
  const isUsablePath = path.length > 0 && looksLikePath && !isUrl
  if (!isUsablePath) {
    return undefined
  }

  const startText = located[2] ?? located[4]
  const endText = located[3] ?? located[5]
  const firstNumber = Math.max(1, Number(startText))
  const secondNumber = endText === undefined ? firstNumber : Math.max(1, Number(endText))

  // A range written backwards, as 30-12, is read as the same region.
  const startLine = Math.min(firstNumber, secondNumber)
  const endLine = Math.max(firstNumber, secondNumber)

  return { path, startLine, endLine }
}

/**
 * Collects every match of a pattern's first group, with its position.
 * @param text the text searched
 * @param pattern a global pattern whose first group is the candidate
 * @returns the candidates in the order found
 */
function collectGroups(text: string, pattern: RegExp): Candidate[] {
  const candidates: Candidate[] = []
  for (const match of text.matchAll(pattern)) {
    const groupText = match[1]
    if (groupText !== undefined) {
      candidates.push({ text: groupText, position: match.index ?? 0 })
    }
  }

  return candidates
}

/**
 * Replaces each match of a pattern with spaces of the same length, so the
 * bare scan neither reads it twice nor shifts any later position.
 * @param text the text
 * @param pattern a global pattern
 * @returns the text with the matches blanked out
 */
function blankOut(text: string, pattern: RegExp): string {
  return text.replace(pattern, match => ' '.repeat(match.length))
}

/**
 * Finds the file regions a text refers to, in the order they appear, each
 * region once.
 * @param text a reply's text
 * @returns the references, at most MAXIMUM_REFERENCES
 */
export function findReferences(text: string): FileReference[] {
  const codeCandidates = collectGroups(text, CODE_SPAN)
  const textWithoutCode = blankOut(text, CODE_SPAN)
  const linkCandidates = collectGroups(textWithoutCode, LINK_TARGET)
  const textWithoutLinks = blankOut(textWithoutCode, LINK_TARGET)

  const bareCandidates: Candidate[] = []
  for (const match of textWithoutLinks.matchAll(BARE_TOKEN)) {
    const tokenText = match[0]
      .replace(WRAPPING_PUNCTUATION_AT_START, '')
      .replace(WRAPPING_PUNCTUATION_AT_END, '')
    bareCandidates.push({ text: tokenText, position: match.index ?? 0 })
  }

  const allCandidates = [...codeCandidates, ...linkCandidates, ...bareCandidates]
  allCandidates.sort((first, second) => first.position - second.position)

  const references: FileReference[] = []
  const seenRegions = new Set<string>()
  for (const candidate of allCandidates) {
    const reference = parseReference(candidate.text)
    if (reference === undefined) {
      continue
    }

    const regionKey = `${reference.path}:${reference.startLine}-${reference.endLine}`
    const isSeen = seenRegions.has(regionKey)
    if (isSeen) {
      continue
    }

    seenRegions.add(regionKey)
    references.push(reference)

    const isFull = references.length >= MAXIMUM_REFERENCES
    if (isFull) {
      break
    }
  }

  return references
}
