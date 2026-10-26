/** A region of a file that a reply referred to, as `src/app.ts:12-30`. */
export type FileReference = {
  /** The path as written in the reply, relative to the session's directory or absolute. */
  path: string
  /** The region's first line, 1-based. */
  startLine: number
  /** The region's last line, 1-based and inclusive; equal to startLine for one line. */
  endLine: number
}

/** Where the pager stands over the file it shows. */
export type PagerView = {
  /** The path as typed after `/view`; empty while no file is open. */
  path: string
  /** The first line shown, 0 at the top of the file. */
  top: number
  /** The highlighted line the moves follow, 0 at the top; always within the window. */
  cursor: number
  /** How many columns each line is shifted left by. */
  left: number
  /** The search pattern, matched case-insensitively unless it holds a capital. */
  query: string
  /** True while the search field is drawn. */
  isSearching: boolean
  /** A one-line notice shown in the status row until the next move. */
  message: string
  /** The highlighted region's first line, 0-based; -1 when nothing is highlighted. */
  highlightStart: number
  /** The highlighted region's last line, 0-based and inclusive; -1 when nothing is highlighted. */
  highlightEnd: number
  /** The regions the last reply referred to, which the r and t keys step through; empty after a typed /view. */
  references: FileReference[]
  /** Which of `references` is shown, 0-based; -1 when none is. */
  referenceIndex: number
  /** True to draw a Markdown file rendered, as a reply is; false draws its syntax-coloured source. */
  isRendered: boolean
  /**
   * True while the file was shown on purpose by the show tool: a reply's file
   * references then leave the pane as it is, until the pane closes or `/view` runs.
   */
  isPinned: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'file-pager': { view: Shaped<PagerView> }
  }

  /** The input of this mod's own show tool, so its tool.call hook narrows. */
  interface McpToolInputs {
    'mcp__file-pager__show': {
      path: string
      line?: number
      endLine?: number
      view?: 'rendered' | 'source'
      pin?: boolean
      focus?: boolean
    }
  }
}
