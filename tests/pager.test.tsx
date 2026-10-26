import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

type On = Parameters<TestBody>[1]

// What the person typing the command sends, as the engine stamps it.
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

const FILE = Array.from({ length: 100 }, (_, index) => `line ${index + 1}${index === 41 ? ' needle' : ''}`).join('\n')

const PANE = {
  plugin: 'file-pager',
  component: 'Pane',
  requestId: 'file-pager',
  props: {
    title: 'notes.md',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

// The panes the mod opened, with whether each asked for the keyboard.
const opened: { id: string; focus?: true; rows?: number }[] = []

// Lets the work the mod queued behind a drawing run: its timer is due at once.
async function settle() {
  for (let turn = 0; turn < 20; turn += 1) {
    await Promise.resolve()
  }
}

// Nothing sits beneath the plugin: each hook here stands for the engine.
function engine(on: On) {
  on('command.register', () => ({ value: { command: 'view' } }))
  on('ui.open', (_$, event) => {
    opened.push({ id: event.id, focus: event.focus, rows: event.rows })

    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  // `$.ui.focus` is a call on `$`, answered with `{ value }`; what it was
  // handed is the mod's own arguments, not the focus event's fields.
  on('ui.log', (_$, event) => {
    // The kit draws no focus ring, so a focus asked from inside a drawing
    // finds nothing to answer it; any other logged failure is a real one.
    if (!event.text.includes('ui.focus')) {
      throw new Error(`the mod logged a failure: ${JSON.stringify(event)}`)
    }

    return { value: undefined }
  })
  on('fs.read', () => ({ value: FILE }))
  // Every file exists but those whose path says they are missing.
  on('fs.exists', (_$, event) => ({ value: !event.path.includes('missing') }))
  on('turn.complete', () => ({ text: '' }))
  on('session.start', (_$, event) => ({ cwd: event.cwd }))
  // A clock that moves a millisecond per reading, and timers that are due at once.
  let now = 1_000_000
  on('clock.now', () => ({ value: (now += 1) }))
  on('clock.after', () => ({ value: undefined }))
}

test('opens a file and moves the cursor and the window with the keys', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ran = await $.command.run({ ...TYPED, command: 'view', args: 'docs/notes.md' })
  expect(ran.text).toContain('100 lines')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /line 1 of 100  lines 1-/ }))?.text).toContain('docs/notes.md')
  expect(await ui.find({ key: 'key:q' })).toBeDefined()
  const cursor = await ui.find({ key: 'cursor' })
  // The cursor's line has no background: it is underlined, and the gutter marks it with `>`.
  expect(cursor?.props.backgroundColor).toBeUndefined()
  expect(cursor?.text).toBe('line 1')
  const underlinedLines = await ui.findAll({ type: 'Text', text: 'line 1' })
  expect(underlinedLines.filter(text => text.props.underline === true)).toHaveLength(1)
  expect(await ui.find({ type: 'Text', text: /^>\s*1$/ })).toBeDefined()
  expect((await ui.find({ type: 'Code' }))?.props.path).toBe('docs/notes.md')

  // The cursor walks down while the window stays put.
  await ui.press({ key: 'key:j' })
  expect(await ui.find({ type: 'Text', text: /line 2 of 100  lines 1-/ })).toBeDefined()
  expect((await ui.find({ key: 'cursor' }))?.text).toBe('line 2')

  // A page moves both, so the cursor keeps its row on screen.
  await ui.press({ key: 'key:f' })
  const paged = await ui.find({ type: 'Text', text: /line \d+ of 100  lines \d+-/ })
  const [, cursorLine, topLine] = /line (\d+) of 100  lines (\d+)-/.exec(paged?.text ?? '') ?? []
  expect(Number(cursorLine) - Number(topLine)).toBe(1)

  await ui.press({ key: 'key:e' })
  expect(await ui.find({ type: 'Text', text: /line 100 of 100 .*\(100%\) \(END\)/ })).toBeDefined()
  expect((await ui.find({ key: 'cursor' }))?.text).toBe('line 100')

  await ui.press({ key: 'key:g' })
  await ui.press({ key: 'key:s' })
  await ui.input({ key: 'search', text: 'needle' })
  // Enter hides the field that held the keyboard; with no key to move the
  // focus onto, the pane is opened again with focus rather than left to the prompt.
  expect(opened.at(-1)).toMatchObject({ id: 'file-pager', focus: true })
  expect(opened).toHaveLength(2)
  // The search lands the cursor on the match, five lines below the window's top.
  expect(await ui.find({ type: 'Text', text: /line 42 of 100  lines 37-/ })).toBeDefined()
  expect((await ui.find({ key: 'cursor' }))?.text).toBe('line 42 needle')
  // Only the line holding the match is drawn plain, so it can be marked;
  // the lines around it keep their syntax colours.
  const colouredRuns = await ui.findAll({ type: 'Code' })
  expect(colouredRuns.length).toBeGreaterThan(0)
  expect(colouredRuns.some(run => String(run.props.source).includes('needle'))).toBe(false)
  const marked = (await ui.findAll({ type: 'Text', text: 'needle' })).filter(text => text.props.inverse === true)
  expect(marked).toHaveLength(1)

  await ui.press({ key: 'key:n' })
  expect(await ui.find({ type: 'Text', text: /Pattern not found/ })).toBeDefined()

  // An empty search clears the pattern and brings the colours back.
  await ui.press({ key: 'key:s' })
  await ui.input({ key: 'search', text: '' })
  expect(await ui.find({ type: 'Code' })).toBeDefined()
  await ui.unmount()
})

test('a line number puts the cursor on it, five lines below the top, in a taller pane', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ran = await $.command.run({ ...TYPED, command: 'view', args: 'docs/notes.md:42' })
  expect(ran.text).toContain('at line 42')
  // Nothing has measured the terminal yet: a third of the assumed 48 rows, plus 20.
  expect(opened.at(-1)?.rows).toBe(36)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /line 42 of 100  lines 37-/ })).toBeDefined()
  expect((await ui.find({ key: 'cursor' }))?.text).toBe('line 42 needle')
  await ui.unmount()
})

test('a line past the end puts the cursor on the last line and says so', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await $.command.run({ ...TYPED, command: 'view', args: 'docs/notes.md:500' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /line 100 of 100 .*\(END\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Line 500 is past the end/ })).toBeDefined()
  await ui.unmount()
})

test('a resize that takes the keyboard away asks for it back', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...TYPED, command: 'view', args: 'docs/notes.md' })
  const opens = opened.length

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.redraw({ ...PANE.props, isFocused: false, bodyColumns: 100 })
  await settle()
  expect(opened.length).toBe(opens + 1)
  expect(opened.at(-1)).toMatchObject({ id: 'file-pager', focus: true })
  await ui.unmount()
})

test('giving the keyboard away without a resize leaves it with the prompt', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ ...TYPED, command: 'view', args: 'docs/notes.md' })
  const opens = opened.length

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.redraw({ ...PANE.props, isFocused: false })
  await settle()
  expect(opened.length).toBe(opens)
  await ui.unmount()
})

test('a file picked from the @ mention menu opens by its plain path', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const quoted = await $.command.run({ ...TYPED, command: 'view', args: '@"docs/my notes.md"' })
  expect(quoted.text).toContain('Opened docs/my notes.md (100 lines)')

  const located = await $.command.run({ ...TYPED, command: 'view', args: '@"docs/my notes.md":42' })
  expect(located.text).toContain('Opened docs/my notes.md at line 42')
})

test('a missing path prints the usage', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect((await $.command.run({ ...TYPED, command: 'view', args: '' })).text).toBe(
    'Usage: /view <path>[:<line>[-<line>]]',
  )
})

/**
 * Ends a main-loop turn whose reply is the given text, as the engine does.
 * @param $ the test's engine interface
 * @param answer the reply's text
 */
function completeTurn($: Parameters<TestBody>[0], answer: string) {
  return $.turn.complete({ answer, durationMs: 10, isAborted: false, turnId: 'turn-1', reason: 'answer' })
}

test('a typed line range highlights the region', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ran = await $.command.run({ ...TYPED, command: 'view', args: 'docs/notes.md:20-24' })
  expect(ran.text).toContain('with lines 20-24 highlighted')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // The cursor lands on the region's first line.
  expect((await ui.find({ key: 'cursor' }))?.text).toBe('line 20')
  // The region's other lines carry the gutter bar beside their numbers, and nothing else.
  const markedRows = await ui.findAll({ type: 'Text', text: /^┃\s*\d+$/ })
  const markedLineNumbers = markedRows.map(row => Number(/\d+/.exec(row.text ?? '')?.[0]))
  expect(markedLineNumbers).toEqual([21, 22, 23, 24])
  // No background is drawn anywhere: not behind the region, not behind the cursor's line.
  const shadedBoxes = (await ui.findAll({ type: 'Box' })).filter(box => box.props.backgroundColor !== undefined)
  expect(shadedBoxes).toEqual([])
  expect(await ui.find({ type: 'Text', text: /region 20-24/ })).toBeDefined()
  // A typed /view keeps no references, so the keys to step through them are not drawn.
  expect(await ui.find({ key: 'key:r' })).toBeUndefined()
  await ui.unmount()
})

test('a reply that refers to file regions opens the first one, leaving the keyboard with the prompt', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const opens = opened.length

  const reply = 'The bug is in `docs/notes.md:40-45`; a missing one is gone/missing.ts:3, and see docs/other.md:70.'
  await completeTurn($, reply)

  expect(opened.length).toBe(opens + 1)
  expect(opened.at(-1)?.focus).toBeUndefined()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /line 40 of 100/ }))?.text).toContain('docs/notes.md')
  // The missing file is passed over, so two references remain.
  expect(await ui.find({ type: 'Text', text: /region 40-45 \(ref 1 of 2\)/ })).toBeDefined()

  // r steps to the next reference, which takes the keyboard as the person pressed a key.
  await ui.press({ key: 'key:r' })
  expect(opened.at(-1)).toMatchObject({ id: 'file-pager', focus: true })
  expect((await ui.find({ type: 'Text', text: /line 70 of 100/ }))?.text).toContain('docs/other.md')
  expect(await ui.find({ type: 'Text', text: /region 70-70 \(ref 2 of 2\)/ })).toBeDefined()

  // t steps back, and both wrap around at the ends.
  await ui.press({ key: 'key:t' })
  expect(await ui.find({ type: 'Text', text: /\(ref 1 of 2\)/ })).toBeDefined()
  await ui.press({ key: 'key:t' })
  expect(await ui.find({ type: 'Text', text: /\(ref 2 of 2\)/ })).toBeDefined()
  await ui.unmount()
})

test('a reply without file references leaves the pager alone', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const opens = opened.length

  await completeTurn($, 'All done; the tests pass.')

  expect(opened.length).toBe(opens)
})

test("a subagent's reply opens nothing", async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const opens = opened.length

  await $.turn.complete({
    answer: 'See docs/notes.md:3',
    durationMs: 10,
    isAborted: false,
    turnId: 'turn-2',
    agentId: 'agent-1',
    reason: 'answer',
  })

  expect(opened.length).toBe(opens)
})
