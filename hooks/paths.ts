/**
 * Completing a partly typed path after `/view`, as a shell's Tab does.
 * Nothing here touches the engine; the caller hands in the folder listing.
 */

import type { FsEntry, PromptAutocompleteSuggestion } from 'claude-code'

/** The most suggestions offered at once. */
const MAXIMUM_SUGGESTIONS = 20

/** The bytes in a kilobyte and in a megabyte, for file sizes. */
const BYTES_PER_KILOBYTE = 1024
const BYTES_PER_MEGABYTE = 1024 * 1024

/** A leading quote typed before a path. */
const LEADING_QUOTE = /^["']/

/**
 * Lists the folder entries that complete a partly typed path, as a shell's
 * Tab does: one folder at a time, folders first, each ending in a separator
 * so that taking it asks the typeahead again for what is inside.
 * @param listFolder lists one folder, the workspace itself when given no path
 * @param token the path typed so far, relative to the workspace or absolute
 * @returns the rows to add to the typeahead; none when the folder is missing
 */
export async function pathSuggestions(
  listFolder: (path?: string) => Promise<FsEntry[]>,
  token: string,
): Promise<PromptAutocompleteSuggestion[]> {
  const typedPath = token.replace(LEADING_QUOTE, '')
  const lastSeparatorIndex = Math.max(typedPath.lastIndexOf('/'), typedPath.lastIndexOf('\\'))
  const nameStart = lastSeparatorIndex + 1
  const folder = typedPath.slice(0, nameStart)
  const namePrefix = typedPath.slice(nameStart).toLowerCase()

  // A folder typed with backslashes alone is completed with backslashes.
  const usesBackslashes = folder.includes('\\')
  const usesForwardSlashes = folder.includes('/')
  const separator = usesBackslashes && !usesForwardSlashes ? '\\' : '/'

  let entries: FsEntry[]
  try {
    entries = await listFolder(folder || undefined)
  } catch {
    return []
  }

  // Dot entries such as .git stay hidden until the name typed starts with a dot.
  const showsDotEntries = namePrefix.startsWith('.')

  return entries
    .filter(entry => entry.kind !== 'other' || entry.isLink)
    .filter(entry => entry.name.toLowerCase().startsWith(namePrefix))
    .filter(entry => showsDotEntries || !entry.name.startsWith('.'))
    .sort(compareEntries)
    .slice(0, MAXIMUM_SUGGESTIONS)
    .map(entry => {
      const isFolder = entry.kind === 'dir'
      const name = isFolder ? `${entry.name}${separator}` : entry.name
      const description = isFolder ? 'folder' : formatSize(entry.size)

      return { text: `${folder}${name}`, label: name, description }
    })
}

/**
 * Orders folder entries folders first, then by name.
 * @param firstEntry one entry
 * @param secondEntry the other entry
 * @returns negative when the first comes first, positive when the second does
 */
function compareEntries(firstEntry: FsEntry, secondEntry: FsEntry): number {
  const firstIsFolder = Number(firstEntry.kind === 'dir')
  const secondIsFolder = Number(secondEntry.kind === 'dir')
  const folderOrder = secondIsFolder - firstIsFolder
  if (folderOrder !== 0) {
    return folderOrder
  }

  return firstEntry.name.localeCompare(secondEntry.name)
}

/**
 * Writes a file's size in bytes, kilobytes or megabytes.
 * @param bytes the size in bytes
 * @returns the size, as `512 B`, `2.0 KB` or `1.5 MB`
 */
function formatSize(bytes: number): string {
  if (bytes < BYTES_PER_KILOBYTE) {
    return `${bytes} B`
  }

  if (bytes < BYTES_PER_MEGABYTE) {
    return `${(bytes / BYTES_PER_KILOBYTE).toFixed(1)} KB`
  }

  return `${(bytes / BYTES_PER_MEGABYTE).toFixed(1)} MB`
}
