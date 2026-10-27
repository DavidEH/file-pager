/**
 * Deciding when a file can be drawn as rendered Markdown rather than as
 * syntax-coloured source. Nothing here touches the engine.
 */

/**
 * The most characters one `Markdown` element draws: the engine's limit for
 * one drawing. A longer file is drawn as source instead.
 */
export const MAXIMUM_RENDERED_CHARACTERS = 100_000

/** File names the pager treats as Markdown: `.md` and `.markdown`, any case. */
const MARKDOWN_EXTENSION = /\.(md|markdown)$/i

/**
 * Says whether a path names a Markdown file, by its extension.
 * @param path the file's path
 * @returns true for a `.md` or `.markdown` file
 */
export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSION.test(path)
}

/**
 * Says whether a file's lines fit in one rendered Markdown drawing.
 * @param lines the file's lines
 * @returns true when the joined text is within MAXIMUM_RENDERED_CHARACTERS
 */
export function fitsRendered(lines: readonly string[]): boolean {
  // Each line but the last is followed by a newline once joined.
  const newlineCount = Math.max(0, lines.length - 1)
  let characterCount = newlineCount
  for (const line of lines) {
    characterCount += line.length
  }

  const doesFit = characterCount <= MAXIMUM_RENDERED_CHARACTERS

  return doesFit
}

/**
 * Says whether a file is to open rendered: a Markdown file opened without a
 * line to land on, unless the caller chose a view.
 * @param path the file's path
 * @param requestedView the view the caller asked for, if any
 * @param hasLine true when the caller asked to land on a line
 * @returns true to draw the file as rendered Markdown
 */
export function shouldOpenRendered(
  path: string,
  requestedView: 'rendered' | 'source' | undefined,
  hasLine: boolean,
): boolean {
  if (requestedView !== undefined) {
    const isRenderedRequested = requestedView === 'rendered'
    const isRenderable = isRenderedRequested && isMarkdownPath(path)

    return isRenderable
  }

  // A line to land on is a place in the source, which only the source view
  // can mark, so a Markdown file opened at a line opens as source.
  const isMarkdown = isMarkdownPath(path)
  const isRenderedByDefault = isMarkdown && !hasLine

  return isRenderedByDefault
}
