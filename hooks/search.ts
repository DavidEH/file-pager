/**
 * Searching the file's lines, with smart case as `less -i` reads it: a
 * pattern in lower case matches any case, one holding a capital matches
 * exactly. Nothing here touches the engine.
 */

/** One run of a shown line: plain text, or a match to mark. */
export type MatchRun = {
  text: string
  isMatch: boolean
}

/**
 * Tells whether a pattern is matched exactly: it is when it holds a capital.
 * @param query the pattern
 * @returns true to match case exactly
 */
export function isCaseSensitive(query: string): boolean {
  return query !== query.toLowerCase()
}

/**
 * Tells whether a line holds the pattern, with smart case.
 * @param line the line
 * @param query the pattern
 * @returns true when the line holds it
 */
export function lineMatches(line: string, query: string): boolean {
  if (isCaseSensitive(query)) {
    return line.includes(query)
  }

  return line.toLowerCase().includes(query.toLowerCase())
}

/**
 * Finds the next line holding the pattern, walking from `startIndex` in
 * `step` direction, without wrapping past either end of the file.
 * @param lines the file's lines
 * @param query the pattern
 * @param startIndex the first line index to test
 * @param step 1 to walk down, -1 to walk up
 * @returns the matching line's index, or -1 when none remains
 */
export function findMatch(lines: string[], query: string, startIndex: number, step: 1 | -1): number {
  for (let lineIndex = startIndex; lineIndex >= 0; lineIndex += step) {
    const isPastEnd = lineIndex >= lines.length
    if (isPastEnd) {
      break
    }

    const line = lines[lineIndex] ?? ''
    if (lineMatches(line, query)) {
      return lineIndex
    }
  }

  return -1
}

/**
 * Splits one shown line into plain and matching runs, so a drawing can mark
 * each match.
 * @param text the line as shown, already shifted left
 * @param query the pattern; empty yields the whole line as one plain run
 * @returns the runs in order, each flagged when it is a match
 */
export function splitMatches(text: string, query: string): MatchRun[] {
  if (!query) {
    return [{ text, isMatch: false }]
  }

  const isExact = isCaseSensitive(query)
  const searchedText = isExact ? text : text.toLowerCase()
  const searchedQuery = isExact ? query : query.toLowerCase()

  const runs: MatchRun[] = []
  let runStart = 0
  let matchStart = searchedText.indexOf(searchedQuery, runStart)
  while (matchStart !== -1) {
    const hasPlainTextBefore = matchStart > runStart
    if (hasPlainTextBefore) {
      runs.push({ text: text.slice(runStart, matchStart), isMatch: false })
    }

    const matchEnd = matchStart + searchedQuery.length
    runs.push({ text: text.slice(matchStart, matchEnd), isMatch: true })
    runStart = matchEnd
    matchStart = searchedText.indexOf(searchedQuery, runStart)
  }

  const hasPlainTextAfter = runStart < text.length
  if (hasPlainTextAfter) {
    runs.push({ text: text.slice(runStart), isMatch: false })
  }

  return runs
}
