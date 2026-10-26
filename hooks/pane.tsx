/**
 * Drawing the pager pane: the file's lines with their gutter, the search
 * field, the status row and the key hints; or, for a Markdown file shown
 * rendered, the whole document as a reply is drawn, under its own short
 * header.
 */

import type { EngineInterface, RenderInput } from 'claude-code'

import type { PagerView } from '../types'

import { CURSOR_MARK, KEY_GAP, MINIMUM_COLUMNS, PANE_ID, REGION_MARK } from './constants'
import { describeError } from './errors'
import { readLines } from './file-lines'
import { observeDrawing, wasFocusLostToSearch } from './focus'
import { layoutKeys } from './keys'
import { fitsRendered, isMarkdownPath } from './markdown'
import type { PagerKey } from './keys'
import { describeStatus, groupRowRuns, isLineInRegion } from './layout'
import { applySearch, goToLine, jumpToMatch, moveCursorBy, pageBy, shiftColumns } from './moves'
import { closePane, openPane, openReference } from './opening'
import { splitMatches } from './search'
import { changeView, pagerMemory, readView } from './state'
import { clampCursor, keepCursorInView } from './window'

/** The rows the footer always takes: the status row. */
const STATUS_ROWS = 1

/**
 * Logs a key's failure to the transcript, so a failed press is seen instead
 * of doing nothing.
 * @param $ the engine interface
 * @param action what was being done, in a few words
 * @param error what was thrown
 */
function logFailure($: EngineInterface, action: string, error: unknown) {
  void $.ui.log(`${action} failed: ${describeError(error)}`)
}

/**
 * Notes the drawing's size and focus, and asks for the keyboard back when it
 * was lost to a resize or to a submitted search hiding its field. The engine
 * grants the focus only while the prompt is empty and free, so this never
 * takes the keyboard from text being typed.
 * @param $ the engine interface
 * @param event the drawing's event
 * @param path the open file, which the reopened pane shows
 */
async function reclaimLostFocus($: EngineInterface, event: RenderInput<'Pane'>, path: string) {
  const now = await $.clock.now()
  const isFocused = event.props.isFocused
  const paneSize = `${event.props.placement} ${event.props.bodyColumns}x${event.props.scroll.bodyRows}`
  const terminalSize = `${event.viewport?.columns}x${event.viewport?.rows}`
  const decision = observeDrawing(pagerMemory.focusTracker, {
    now,
    size: `${paneSize} ${terminalSize}`,
    isFocused,
  })
  pagerMemory.focusTracker = decision.tracker

  // A focused drawing does not spend the search's claim: the drawing that
  // hides the field can still show the pane focused, with the keyboard
  // leaving only after it. The claim is spent once it takes the keyboard
  // back, or runs out with the time window.
  const isLostToSearch = wasFocusLostToSearch(pagerMemory.searchSubmittedAt, now, isFocused)
  if (isLostToSearch) {
    pagerMemory.searchSubmittedAt = 0
  }

  const shouldReclaimFocus = decision.shouldReclaimFocus || isLostToSearch
  if (!shouldReclaimFocus) {
    return
  }

  // Asked after the drawing rather than from inside it.
  void $.clock.after(0, () => {
    void openPane($, path).catch(error => logFailure($, 'refocus', error))
  })
}

/** The words the status row adds while the show tool's file is pinned. */
const PINNED_LABEL = 'pinned'

/**
 * Makes the key that switches a Markdown file between its rendered and its
 * source view. A file too long to render stays in the source view, saying so.
 * @param $ the engine interface
 * @param lines the file's lines
 * @returns the key
 */
function makeViewToggleKey($: EngineInterface, lines: readonly string[]): PagerKey {
  const toggleView = async () => {
    await changeView($, currentView => {
      const isSwitchingToRendered = !currentView.isRendered
      const isTooLong = isSwitchingToRendered && !fitsRendered(lines)
      if (isTooLong) {
        return { ...currentView, message: 'Too long to render' }
      }

      return { ...currentView, isRendered: isSwitchingToRendered, isSearching: false, message: '' }
    })
  }

  return { hotkey: 'm', label: 'rendered/source', run: toggleView }
}

/**
 * Draws a Markdown file rendered: a header with the path, the status and the
 * keys, then the whole document. The engine scrolls it, by the arrows, the
 * page keys and the wheel, since rendered rows do not follow the file's lines.
 * @param $ the engine interface
 * @param event the drawing's event
 * @param view the stored view
 * @param lines the file's lines
 * @returns the pane's tree
 */
function renderMarkdownPane($: EngineInterface, event: RenderInput<'Pane'>, view: PagerView, lines: readonly string[]) {
  const { Box, Text, Button, Markdown } = $.ui.resolve(event)
  const columns = Math.max(MINIMUM_COLUMNS, event.props.bodyColumns)

  const keys: PagerKey[] = [
    makeViewToggleKey($, lines),
    { hotkey: 'g', label: 'top', run: () => $.ui.scroll({ in: PANE_ID, to: 'start' }) },
    { hotkey: 'e', label: 'end', run: () => $.ui.scroll({ in: PANE_ID, to: 'end' }) },
    { hotkey: 'q', label: 'quit', run: () => closePane($) },
  ]
  const keyRows = layoutKeys(keys, columns)

  /**
   * Draws one key hint as a plain button.
   * @param key the key hint
   */
  const drawKey = (key: PagerKey) => {
    const press = () => {
      void key.run().catch(error => logFailure($, key.label, error))
    }

    return <Button key={`key:${key.hotkey}`} hotkey={key.hotkey} label={key.label} plain dimColor onPress={press} />
  }

  const pinnedText = view.isPinned ? `  ${PINNED_LABEL}` : ''
  const statusText = `rendered, ${lines.length} lines${pinnedText}  (arrows and page keys scroll)`

  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end">
        <Text weight="bold">{view.path}</Text>
        <Text dimColor>
          {'  '}
          {statusText}
        </Text>
        {view.message ? (
          <Text color="warning">
            {'  '}
            {view.message}
          </Text>
        ) : (
          ''
        )}
      </Text>
      {keyRows.map(row => (
        <Box flexDirection="row" columnGap={KEY_GAP}>
          {row.map(drawKey)}
        </Box>
      ))}
      <Box marginTop={1} flexDirection="column">
        <Markdown key="document" text={lines.join('\n')} />
      </Box>
    </Box>
  )
}

/**
 * Draws the pager pane for the open file.
 * @param $ the engine interface
 * @param event the drawing's event
 * @returns the pane's tree
 */
export async function renderPane($: EngineInterface, event: RenderInput<'Pane'>) {
  const elementTable = $.ui.resolve(event)
  const { Box, Text, Button, Code } = elementTable
  const Input = 'Input' in elementTable ? elementTable.Input : undefined
  const view = await readView($)

  if (!view.path) {
    return <Text dimColor>Run /view &lt;path&gt; to open a file.</Text>
  }

  let lines: string[]
  try {
    lines = await readLines($, view.path)
  } catch (error) {
    return (
      <Text color="error">
        Cannot read {view.path}: {describeError(error)}
      </Text>
    )
  }

  // A file that grew past the limit since it opened is drawn as source.
  const isRenderedShown = view.isRendered && fitsRendered(lines)
  if (isRenderedShown) {
    return renderMarkdownPane($, event, view, lines)
  }

  const lineCount = lines.length
  const columns = Math.max(MINIMUM_COLUMNS, event.props.bodyColumns)
  const halfWidth = Math.floor(columns / 2)
  const isSearching = view.isSearching && Input !== undefined

  // The room is only known once the footer is laid out, and the keys need
  // the room, so the keys read it through this variable when pressed.
  let room = 1
  const currentSize = () => ({ lineCount, room })
  const halfRoom = () => Math.ceil(room / 2)

  /**
   * Makes a key's action that stores the view a move works out.
   * @param move works out the next view from the current one
   */
  const applyMove = (move: (current: PagerView) => PagerView) => () => changeView($, move)

  /**
   * Applies a submitted search. Hiding the field that holds the focus hands
   * the keyboard back to the prompt, so the focus moves first to a key that
   * stays drawn. When that move is refused, opening the pane again with focus
   * takes the keyboard back at once; when it was granted but the keyboard
   * still went to the prompt, the next drawing sees the pane unfocused and
   * takes it back (see reclaimLostFocus).
   * @param query the pattern submitted
   */
  const submitSearch = async (query: string) => {
    const focusResult = await $.ui
      .focus({ requestId: PANE_ID, key: 'key:n' })
      .catch((error: unknown) => ({ deny: describeError(error) }))

    const wasFocusRefused = focusResult.deny !== undefined
    if (wasFocusRefused) {
      pagerMemory.searchSubmittedAt = 0
    } else {
      pagerMemory.searchSubmittedAt = await $.clock.now()
    }

    await changeView($, currentView => applySearch(currentView, lines, room, query))

    if (wasFocusRefused) {
      await openPane($, view.path)
    }
  }

  /** Opens the search field and gives it the keyboard. */
  const startSearch = async () => {
    await changeView($, currentView => ({ ...currentView, isSearching: true, message: '' }))
    await $.ui.focus({ requestId: PANE_ID, key: 'search' })
  }

  const movementKeys: PagerKey[] = [
    { hotkey: 'j', label: 'down', run: applyMove(current => moveCursorBy(current, 1, currentSize())) },
    { hotkey: 'k', label: 'up', run: applyMove(current => moveCursorBy(current, -1, currentSize())) },
    { hotkey: 'f', label: 'page down', run: applyMove(current => pageBy(current, room, currentSize())) },
    { hotkey: 'b', label: 'page up', run: applyMove(current => pageBy(current, -room, currentSize())) },
    { hotkey: 'd', label: 'half down', run: applyMove(current => pageBy(current, halfRoom(), currentSize())) },
    { hotkey: 'u', label: 'half up', run: applyMove(current => pageBy(current, -halfRoom(), currentSize())) },
    { hotkey: 'g', label: 'top', run: applyMove(current => goToLine(current, 0, currentSize())) },
    { hotkey: 'e', label: 'end', run: applyMove(current => goToLine(current, lineCount - 1, currentSize())) },
    { hotkey: 'h', label: 'left', run: applyMove(current => shiftColumns(current, -halfWidth)) },
    { hotkey: 'l', label: 'right', run: applyMove(current => shiftColumns(current, halfWidth)) },
  ]

  // Search needs a field to type into, which not every surface draws.
  const searchKeys: PagerKey[] = Input === undefined
    ? []
    : [
        { hotkey: 's', label: 'search', run: startSearch },
        { hotkey: 'n', label: 'next', run: applyMove(current => jumpToMatch(current, lines, room, 1)) },
        { hotkey: 'p', label: 'previous', run: applyMove(current => jumpToMatch(current, lines, room, -1)) },
      ]

  // The regions a reply referred to: r steps to the next, t to the previous,
  // each wrapping around at the ends.
  const hasSeveralReferences = view.references.length > 1
  const nextReferenceIndex = view.referenceIndex + 1
  const previousReferenceIndex = view.referenceIndex - 1
  const referenceKeys: PagerKey[] = hasSeveralReferences
    ? [
        {
          hotkey: 'r',
          label: 'next ref',
          run: () => openReference($, view.references, nextReferenceIndex, 1, true),
        },
        {
          hotkey: 't',
          label: 'prev ref',
          run: () => openReference($, view.references, previousReferenceIndex, -1, true),
        },
      ]
    : []

  // A Markdown file can switch to its rendered view.
  const viewKeys: PagerKey[] = isMarkdownPath(view.path) ? [makeViewToggleKey($, lines)] : []

  const quitKey: PagerKey = { hotkey: 'q', label: 'quit', run: () => closePane($) }
  const keys = [...movementKeys, ...searchKeys, ...referenceKeys, ...viewKeys, quitKey]

  // The footer: the status row, the key rows and, while searching, the field.
  const keyRows = layoutKeys(keys, columns)
  const searchRows = isSearching ? 1 : 0
  const footerRows = STATUS_ROWS + keyRows.length + searchRows
  room = Math.max(1, event.props.scroll.bodyRows - footerRows)
  pagerMemory.drawnRoom = room
  pagerMemory.terminalRows = event.viewport?.rows ?? pagerMemory.terminalRows

  await reclaimLostFocus($, event, view.path)

  // A stored window can be stale when the room changed (the pane resized),
  // so the cursor is held in view against the room drawn now.
  const cursor = clampCursor(view.cursor, lineCount)
  const top = keepCursorInView(view.top, cursor, lineCount, room)
  const shownLines = lines.slice(top, top + room).map(line => line.slice(view.left))
  const cursorRow = cursor - top
  const gutterWidth = String(lineCount).length
  const shownEnd = top + shownLines.length
  const positionText = describeStatus(view, { cursor, top, shownEnd, lineCount })
  const pinnedText = view.isPinned ? `  ${PINNED_LABEL}` : ''
  const statusText = `${positionText}${pinnedText}`
  const rowRuns = groupRowRuns(shownLines, cursorRow, view.query)
  const emptyRowCount = room - shownLines.length

  /**
   * Draws one line plain, marking search matches; the cursor's line is
   * underlined. An empty line is drawn as a space, so no row collapses.
   * @param line the line as shown
   * @param isUnderlined true for the cursor's line
   */
  const drawPlainLine = (line: string, isUnderlined = false) => {
    const runs = splitMatches(line || ' ', view.query)

    return (
      <Text wrap="truncate-end" underline={isUnderlined}>
        {runs.map(run => (run.isMatch ? <Text inverse>{run.text}</Text> : run.text))}
      </Text>
    )
  }

  /**
   * Draws lines with the engine's syntax colours. An empty line is drawn as
   * a space, so no row collapses.
   * @param runLines the lines as shown
   */
  const drawColouredLines = (runLines: string[]) => {
    const source = runLines.map(line => line || ' ').join('\n')

    return <Code source={source} path={view.path} wrap="truncate-end" />
  }

  /**
   * Draws one row of the gutter: the line number, marked for the cursor's
   * line and for the region's lines.
   * @param row the row in the window, 0-based
   */
  const drawGutterRow = (row: number) => {
    const lineIndex = top + row
    const lineNumber = String(lineIndex + 1).padStart(gutterWidth)
    const isCursorRow = row === cursorRow
    if (isCursorRow) {
      return (
        <Text color="claude" weight="bold">
          {CURSOR_MARK}
          {lineNumber}
        </Text>
      )
    }

    if (isLineInRegion(view, lineIndex)) {
      return (
        <Text>
          <Text color="claude">{REGION_MARK}</Text>
          {lineNumber}
        </Text>
      )
    }

    return (
      <Text dimColor>
        {' '}
        {lineNumber}
      </Text>
    )
  }

  /**
   * Draws one run of lines. The cursor's line is underlined; the highlighter
   * cannot underline, so that one line is drawn plain. The highlighter owns
   * every colour it draws and cannot mark a range, so the lines holding a
   * search match are drawn plain, for the matches to be marked; every other
   * line keeps its syntax colours.
   * @param run the run
   */
  const drawRowRun = (run: (typeof rowRuns)[number]) => {
    if (run.kind === 'cursor') {
      return <Box key="cursor">{drawPlainLine(run.lines[0] ?? '', true)}</Box>
    }

    if (run.kind === 'match') {
      return run.lines.map(line => drawPlainLine(line))
    }

    return drawColouredLines(run.lines)
  }

  /**
   * Draws one key hint as a plain button.
   * @param key the key hint
   */
  const drawKey = (key: PagerKey) => {
    const press = () => {
      void key.run().catch(error => logFailure($, key.label, error))
    }

    return <Button key={`key:${key.hotkey}`} hotkey={key.hotkey} label={key.label} plain dimColor onPress={press} />
  }

  const hasShownLines = shownLines.length > 0

  return (
    <Box flexDirection="column">
      {hasShownLines && (
        <Box flexDirection="row">
          {/* The gutter is drawn here rather than by Code, so the runs of
              lines share one width and the cursor's number can be marked. */}
          <Box flexDirection="column" marginRight={1}>
            {shownLines.map((_line, row) => drawGutterRow(row))}
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            {rowRuns.map(drawRowRun)}
          </Box>
        </Box>
      )}
      {Array.from({ length: emptyRowCount }, () => (
        <Text dimColor>~</Text>
      ))}
      {isSearching && Input && (
        <Input
          key="search"
          label="/"
          placeholder="pattern (empty clears)"
          value={view.query}
          submitLabel="search"
          autoFocus
          onSubmit={query => {
            void submitSearch(query).catch(error => logFailure($, 'search', error))
          }}
        />
      )}
      <Text wrap="truncate-end">
        <Text weight="bold">{view.path}</Text>
        <Text dimColor>
          {'  '}
          {statusText}
        </Text>
        {view.message ? (
          <Text color="warning">
            {'  '}
            {view.message}
          </Text>
        ) : (
          ''
        )}
      </Text>
      {keyRows.map(row => (
        <Box flexDirection="row" columnGap={KEY_GAP}>
          {row.map(drawKey)}
        </Box>
      ))}
    </Box>
  )
}
