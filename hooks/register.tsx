/**
 * The pager mod's hooks: `/view` and its path completion, the show tool
 * Claude calls, the regions a reply refers to, and the pane's closing,
 * scrolling and drawing. Each hook
 * hands its work to the file that does it.
 */

import type { Register } from 'claude-code'

import type { PANE_ID } from './constants'
import { describeError } from './errors'
import { scrollBy } from './moves'
import { openTarget, showReferencesFrom } from './opening'
import type { OpenOutcome } from './opening'
import { renderPane } from './pane'
import { pathSuggestions } from './paths'
import { SHOW_TOOL_SPEC, runShowTool } from './show-tool'
import { CLOSED_VIEW, changeView, forgetOpenPane, pagerMemory, readView } from './state'
import { parseTarget } from './target'
import type { ViewTarget } from './target'

// The engine's scan reads a hook's matcher only from this file, so the pane
// id is written here as a literal. Its type is PANE_ID's, so the two cannot
// drift apart without the type check failing.
const MATCHED_PANE_ID: typeof PANE_ID = 'file-pager'

// The show tool's full name, written as a literal for the same reason.
const SHOW_TOOL_FULL_NAME = 'mcp__file-pager__show'

/** What /view prints when it was run without a path. */
const USAGE_TEXT = 'Usage: /view <path>[:<line>[-<line>]]'

/** Matches the prompt text before the token when that token is /view's path. */
const VIEW_PATH_POSITION = /^\/view\s+$/

/**
 * Says where /view landed in the file it opened.
 * @param target what was typed
 * @param lineCount the file's lines
 * @returns the words to add after the path; empty when no line was given
 */
function describeLanding(target: ViewTarget, lineCount: number): string {
  if (target.line === undefined) {
    return ''
  }

  const landedLine = Math.min(target.line, lineCount)
  if (target.endLine === undefined) {
    return ` at line ${landedLine}`
  }

  const landedEndLine = Math.min(target.endLine, lineCount)

  return ` with lines ${landedLine}-${landedEndLine} highlighted`
}

export const register: Register = on => {
  on('session.start', async ($, event, next) => {
    await $.command.register({
      name: 'view',
      description: 'Page through a file in a pane, with less-style keys',
      argumentHint: '<path>[:<line>[-<line>]]',
    })
    await $.tool.register(SHOW_TOOL_SPEC)

    return next(event)
  })

  // Claude's call of the show tool: the file opens in the pane, pinned, and
  // the result says how it was drawn. An error reaches the model as one.
  on('tool.call', { tool: SHOW_TOOL_FULL_NAME }, async ($, event) => {
    // The tool's arguments sit on the event itself, beside `tool`.
    const outcome = await runShowTool($, event)
    if (outcome.isError) {
      return { deny: outcome.text }
    }

    return { result: outcome.text }
  })

  on('command.run', { command: 'view' }, async ($, event) => {
    const target = parseTarget(event.args)
    if (!target.path) {
      return { text: USAGE_TEXT }
    }

    // A typed /view takes over the pane: it unpins what the show tool pinned.
    // It opens the source, as it always has; m switches a Markdown file to
    // its rendered view.
    let outcome: OpenOutcome
    try {
      outcome = await openTarget($, {
        path: target.path,
        startLine: target.line,
        endLine: target.endLine,
        shouldFocus: true,
        references: [],
        referenceIndex: -1,
        isRendered: false,
        isPinned: false,
      })
    } catch (error) {
      return { text: `Cannot open ${target.path}: ${describeError(error)}` }
    }

    const landing = describeLanding(target, outcome.lineCount)
    const where = outcome.isPlaced ? 'in the pager pane' : 'in the pager pane, which shows once the terminal has room'

    return { text: `Opened ${target.path}${landing} (${outcome.lineCount} lines) ${where}. Press q to close it.` }
  })

  // After each of Claude's replies on the main loop, the first file region
  // it refers to opens in the pager, highlighted; the r and t keys step
  // through the rest. The keyboard stays with the prompt.
  on('turn.complete', async ($, event, next) => {
    const result = await next(event)
    const isMainLoop = event.agentId === undefined
    const isAnswer = event.reason === 'answer'
    const isMainLoopAnswer = isMainLoop && isAnswer
    if (!isMainLoopAnswer) {
      return result
    }

    try {
      await showReferencesFrom($, event.answer)
    } catch (error) {
      void $.ui.log(`opening the reply's file reference failed: ${describeError(error)}`)
    }

    return result
  })

  // Completes the path after `/view `, and only its first word: anything else
  // typed in the prompt goes to the other plugins and the engine untouched.
  on('prompt.autocomplete', async ($, event, next) => {
    const textBeforeToken = event.text.slice(0, event.start)
    const isViewPath = VIEW_PATH_POSITION.test(textBeforeToken)
    if (!isViewPath) {
      return next(event)
    }

    const listFolder = (path?: string) => $.fs.list(path)
    const [ownSuggestions, otherSuggestions] = await Promise.all([
      pathSuggestions(listFolder, event.token),
      next(event),
    ])

    return { suggestions: [...otherSuggestions.suggestions, ...ownSuggestions] }
  })

  on('ui.close', { id: MATCHED_PANE_ID }, async ($, event, next) => {
    forgetOpenPane()
    await changeView($, () => CLOSED_VIEW)

    return next(event)
  })

  // The pane draws its own window over the file so the key hints stay pinned
  // at the bottom: the engine's scroll is refused and replayed as a move.
  // Rendered Markdown has no lines to page by, so there the engine scrolls.
  on('ui.scroll', { component: 'Pane', requestId: MATCHED_PANE_ID }, async ($, event, next) => {
    const currentView = await readView($)
    if (currentView.isRendered) {
      return next(event)
    }

    const lineCount = pagerMemory.loadedFile?.lines.length ?? 0
    const size = { lineCount, room: pagerMemory.drawnRoom }
    const request = { rowAmount: event.by, bodyRows: event.bodyRows, isPointer: event.pointer !== undefined }
    await changeView($, currentView => scrollBy(currentView, request, size))

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: MATCHED_PANE_ID }, ($, event) => renderPane($, event))
}
