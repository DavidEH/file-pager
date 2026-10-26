/**
 * Reading a file into the lines the pager draws.
 */

import type { EngineInterface } from 'claude-code'

import { TAB_AS_SPACES } from './constants'
import { pagerMemory } from './state'

/** Control characters other than tab and newline, which the drawing elements refuse. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g

/**
 * Splits a file's text into the lines the pager draws: tabs become spaces,
 * since a tab's width is the terminal's to choose, and other control
 * characters become spaces too. The empty line after a final newline is
 * dropped.
 * @param text the file's text
 * @returns the lines
 */
export function splitIntoDisplayLines(text: string): string[] {
  const lines = text
    .replaceAll('\t', TAB_AS_SPACES)
    .split(/\r?\n/)
    .map(line => line.replace(CONTROL_CHARACTERS, ' '))

  const hasSeveralLines = lines.length > 1
  const endsWithNewline = lines[lines.length - 1] === ''
  const hasEmptyLastLine = hasSeveralLines && endsWithNewline
  if (hasEmptyLastLine) {
    lines.pop()
  }

  return lines
}

/**
 * The lines of a file, read once and then kept in memory while it stays open.
 * @param $ the engine interface
 * @param path the file, relative to the session's directory or absolute
 * @returns the file's lines
 * @throws when the file cannot be read
 */
export async function readLines($: EngineInterface, path: string): Promise<string[]> {
  const loadedFile = pagerMemory.loadedFile
  const isLoaded = loadedFile !== undefined && loadedFile.path === path
  if (isLoaded) {
    return loadedFile.lines
  }

  const text = await $.fs.read(path)
  const lines = splitIntoDisplayLines(text)
  pagerMemory.loadedFile = { path, lines }

  return lines
}

/** Forgets the open file's lines, so the next read takes them from disk afresh. */
export function forgetLoadedLines() {
  pagerMemory.loadedFile = undefined
}
