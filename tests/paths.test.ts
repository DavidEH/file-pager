import { expect, test } from 'claude-code/testing'
import type { FsEntry } from 'claude-code'

import { pathSuggestions } from '../hooks/paths'

function entry(name: string, kind: FsEntry['kind'], size = 0): FsEntry {
  return { name, kind, size, mtimeMs: 0, isLink: false }
}

// A workspace of two folders, keyed by the path the listing is asked for.
const TREE: Record<string, FsEntry[]> = {
  '.': [
    entry('docs', 'dir'),
    entry('.git', 'dir'),
    entry('README.md', 'file', 2048),
    entry('Directory.Build.props', 'file', 10),
  ],
  'docs/': [entry('specs', 'dir'), entry('design.md', 'file', 512)],
}

async function list(path?: string): Promise<FsEntry[]> {
  const folderEntries = TREE[path ?? '.']
  if (!folderEntries) {
    throw new Error(`ENOENT: ${path}`)
  }

  return folderEntries
}

test('completes names in the workspace, folders first and case-insensitively', async () => {
  const rows = await pathSuggestions(list, 'd')

  expect(rows.map(row => row.text)).toEqual(['docs/', 'Directory.Build.props'])
  expect(rows[0]?.description).toBe('folder')
  expect(rows[1]?.description).toBe('10 B')
})

test('lists inside a folder once its separator is typed', async () => {
  const rows = await pathSuggestions(list, 'docs/')

  expect(rows.map(row => row.text)).toEqual(['docs/specs/', 'docs/design.md'])
  expect(rows.map(row => row.label)).toEqual(['specs/', 'design.md'])
})

test('hides dot entries until the name typed starts with a dot', async () => {
  expect((await pathSuggestions(list, 'R')).map(row => row.text)).toEqual(['README.md'])
  expect((await pathSuggestions(list, '.')).map(row => row.text)).toEqual(['.git/'])
})

test('a folder that does not exist suggests nothing', async () => {
  expect(await pathSuggestions(list, 'missing/x')).toEqual([])
})

test('an opening quote is read past', async () => {
  expect((await pathSuggestions(list, '"docs/d')).map(row => row.text)).toEqual(['docs/design.md'])
})
