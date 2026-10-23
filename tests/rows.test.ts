import { expect, test } from 'claude-code/testing'

import { Rows } from '../hooks/rows'

test('no row on screen: no anchor', async () => {
  const rows = new Rows()
  rows.see('UserMessage:a', false)
  expect(rows.anchor()).toBe(null)
})

test('the anchor is the latest row on screen', async () => {
  const rows = new Rows()
  rows.see('InfoNotice:n', true)
  rows.see('UserMessage:u', true)
  rows.see('AssistantMessage:m', true)
  expect(rows.anchor()).toBe('AssistantMessage:m')
})

test('scrolled up: the anchor is the latest row still on screen', async () => {
  const rows = new Rows()
  rows.see('UserMessage:u', true)
  rows.see('AssistantMessage:m', true)
  rows.see('TurnDuration:t', false)
  expect(rows.anchor()).toBe('AssistantMessage:m')
})

test('a redrawn row keeps the order it was first seen in', async () => {
  const rows = new Rows()
  rows.see('UserMessage:u', true)
  rows.see('AssistantMessage:m', true)
  rows.see('UserMessage:u', true)
  expect(rows.anchor()).toBe('AssistantMessage:m')
})

test('a row is on screen as it was last seen', async () => {
  const rows = new Rows()
  rows.see('UserMessage:u', true)
  expect(rows.isOnScreen('UserMessage:u')).toBe(true)
  rows.see('UserMessage:u', false)
  expect(rows.isOnScreen('UserMessage:u')).toBe(false)
  expect(rows.isOnScreen('UserMessage:never')).toBe(false)
})
