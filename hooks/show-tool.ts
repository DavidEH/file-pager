/**
 * The show tool: Claude calls it to put a file in the pager pane on purpose,
 * such as a scratchpad document holding context kept out of the chat. This
 * file holds its spec, reads its input and opens the file; register.tsx
 * hooks the call.
 */

import type { EngineInterface, ToolSpec } from 'claude-code'

import { describeError } from './errors'
import { shouldOpenRendered } from './markdown'
import { openTarget } from './opening'

/** The tool's short name; the model calls it as `mcp__file-pager__show`. */
export const SHOW_TOOL_NAME = 'show'

/** What the model reads about the tool, and the input it takes. */
export const SHOW_TOOL_SPEC: ToolSpec = {
  name: SHOW_TOOL_NAME,
  description: [
    "Shows a file in the pager pane beside the chat, for the person to read alongside the conversation.",
    'Use it for supporting documents (research notes, comparisons, long walkthroughs) kept out of the chat reply.',
    'Markdown files are drawn rendered unless a line is given or view is "source"; the person toggles with m.',
    "The keyboard stays with the person's prompt unless focus is true.",
    "By default the file is pinned: file references in later replies do not replace it until the pane closes or the person runs /view.",
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: "The file to show: absolute, or relative to the session's working directory.",
      },
      line: {
        type: 'integer',
        minimum: 1,
        description: 'A 1-based line to land on; opens the source view.',
      },
      endLine: {
        type: 'integer',
        minimum: 1,
        description: 'With line: the last line of a region to highlight, inclusive.',
      },
      view: {
        type: 'string',
        enum: ['rendered', 'source'],
        description: 'How to draw a Markdown file; rendered by default when no line is given.',
      },
      pin: {
        type: 'boolean',
        description: 'Keep later replies from replacing the file; true by default.',
      },
      focus: {
        type: 'boolean',
        description: 'Give the pane the keyboard; false by default, so the person keeps typing.',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },
  // The model should see the tool from the first turn, not find it by search.
  isDeferred: false,
}

/** The tool's input once checked. */
export type ShowRequest = {
  path: string
  line?: number
  endLine?: number
  view?: 'rendered' | 'source'
  isPinned: boolean
  shouldFocus: boolean
}

/**
 * Reads a whole number of at least 1, or nothing.
 * @param value what the input held
 * @returns the number, or undefined when the value is not one
 */
function readLineNumber(value: unknown): number | undefined {
  const isNumber = typeof value === 'number'
  const isWholeNumber = isNumber && Number.isInteger(value)
  const isLineNumber = isWholeNumber && (value as number) >= 1
  if (!isLineNumber) {
    return undefined
  }

  return value as number
}

/**
 * Checks the tool's input and fills in its defaults.
 * @param input what the model sent
 * @returns the request, or an error message saying what is wrong
 */
export function parseShowInput(rawInput: unknown): ShowRequest | { error: string } {
  const isObject = typeof rawInput === 'object' && rawInput !== null
  if (!isObject) {
    return { error: 'The input must be an object holding path.' }
  }

  const input = rawInput as Record<string, unknown>
  const rawPath = input.path
  const isPathText = typeof rawPath === 'string'
  const path = isPathText ? rawPath.trim() : ''
  if (path === '') {
    return { error: 'path is required: the file to show.' }
  }

  const line = readLineNumber(input.line)
  const endLine = readLineNumber(input.endLine)
  const hasEndLineWithoutLine = endLine !== undefined && line === undefined
  if (hasEndLineWithoutLine) {
    return { error: 'endLine needs line: the region starts at line.' }
  }

  const rawView = input.view
  const isKnownView = rawView === 'rendered' || rawView === 'source'
  const view = isKnownView ? rawView : undefined

  // A pin is the default: the point of the tool is a file that stays put.
  const isPinned = input.pin !== false
  const shouldFocus = input.focus === true

  return { path, line, endLine, view, isPinned, shouldFocus }
}

/**
 * Shows the requested file in the pager and says what came of it, in words
 * the model reads as the tool's result.
 * @param $ the engine interface
 * @param input what the model sent
 * @returns the result text, and whether it reports an error
 */
export async function runShowTool(
  $: EngineInterface,
  input: unknown,
): Promise<{ text: string; isError: boolean }> {
  const parsed = parseShowInput(input)
  if ('error' in parsed) {
    return { text: parsed.error, isError: true }
  }

  const hasLine = parsed.line !== undefined
  const isRendered = shouldOpenRendered(parsed.path, parsed.view, hasLine)

  try {
    const outcome = await openTarget($, {
      path: parsed.path,
      startLine: parsed.line,
      endLine: parsed.endLine,
      shouldFocus: parsed.shouldFocus,
      references: [],
      referenceIndex: -1,
      isRendered,
      isPinned: parsed.isPinned,
    })

    const drawing = outcome.isRendered ? 'rendered Markdown' : 'source'
    const pinning = parsed.isPinned ? ', pinned' : ''
    const placement = outcome.isPlaced ? '' : ' The pane shows once the terminal has room.'

    return {
      text: `Showing ${parsed.path} in the pager pane (${outcome.lineCount} lines, ${drawing}${pinning}).${placement}`,
      isError: false,
    }
  } catch (error) {
    return { text: `Cannot show ${parsed.path}: ${describeError(error)}`, isError: true }
  }
}
