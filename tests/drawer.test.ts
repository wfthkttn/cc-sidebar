import { expect, test } from 'claude-code/testing'

import { Rows } from '../hooks/drawer'

test('no row on screen: no anchor', async () => {
  const rows = new Rows()
  rows.see('UserMessage:a', null)
  expect(rows.anchor()).toBe(null)
})

test('the anchor is the latest row on screen', async () => {
  const rows = new Rows()
  rows.see('InfoNotice:n', { first: 0, last: 1, of: 2 })
  rows.see('UserMessage:u', { first: 0, last: 2, of: 3 })
  rows.see('AssistantMessage:m', { first: 0, last: 12, of: 13 })
  expect(rows.anchor()).toBe('AssistantMessage:m')
})

test('scrolled up: the anchor is the latest row still on screen', async () => {
  const rows = new Rows()
  rows.see('UserMessage:u', { first: 3, last: 4, of: 5 })
  rows.see('AssistantMessage:m', { first: 0, last: 40, of: 81 })
  rows.see('TurnDuration:t', null)
  expect(rows.anchor()).toBe('AssistantMessage:m')
})

test('a redrawn row keeps the order it was first seen in', async () => {
  const rows = new Rows()
  rows.see('UserMessage:u', { first: 0, last: 2, of: 3 })
  rows.see('AssistantMessage:m', { first: 0, last: 9, of: 10 })
  rows.see('UserMessage:u', { first: 1, last: 2, of: 3 })
  expect(rows.anchor()).toBe('AssistantMessage:m')
})
