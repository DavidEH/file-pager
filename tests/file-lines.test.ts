import { expect, test } from 'claude-code/testing'

import { splitIntoDisplayLines } from '../hooks/file-lines'

test('splits on either line ending and drops the empty line after a final newline', () => {
  expect(splitIntoDisplayLines('one\r\ntwo\nthree\n')).toEqual(['one', 'two', 'three'])
})

test('draws tabs as four spaces and other control characters as one space', () => {
  expect(splitIntoDisplayLines('\tindented\u0007bell')).toEqual(['    indented bell'])
})

test('an empty file is one empty line', () => {
  expect(splitIntoDisplayLines('')).toEqual([''])
})
