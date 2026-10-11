import { expect, test } from 'claude-code/testing'

import { Rows } from '../hooks/drawer'

test('no row on screen: no anchor', async () => {
  const rows = new Rows()
  rows.see('UserMessage:a', null)
  expect(rows.anchor(66)).toBe(null)
})

test('short transcript: the last row carries the drawer, up by the rows above it', async () => {
  const rows = new Rows()
  rows.see('InfoNotice:n', { first: 0, last: 1, of: 2 })
  rows.see('UserMessage:u', { first: 0, last: 2, of: 3 })
  rows.see('AssistantMessage:m', { first: 0, last: 12, of: 13 })
  expect(rows.anchor(66)).toEqual({ key: 'AssistantMessage:m', top: -5 })
})

test('scrolled to the end: the drawer reaches up a screen from the bottom row', async () => {
  const rows = new Rows()
  rows.see('UserMessage:u', null)
  rows.see('AssistantMessage:m', { first: 17, last: 80, of: 81 })
  rows.see('TurnDuration:t', { first: 0, last: 1, of: 2 })
  expect(rows.anchor(66)).toEqual({ key: 'TurnDuration:t', top: -64 })
})

test('scrolled to the end: a row that vanished without reporting it moves nothing', async () => {
  const rows = new Rows()
  rows.see('InfoNotice:gone', { first: 0, last: 1, of: 2 })
  rows.see('UserMessage:u', null)
  rows.see('AssistantMessage:m', { first: 17, last: 80, of: 81 })
  rows.see('TurnDuration:t', { first: 0, last: 1, of: 2 })
  expect(rows.anchor(66)).toEqual({ key: 'TurnDuration:t', top: -64 })
})

test('scrolled up: the bottom row is the latest one still on screen', async () => {
  const rows = new Rows()
  rows.see('UserMessage:u', { first: 3, last: 4, of: 5 })
  rows.see('AssistantMessage:m', { first: 0, last: 40, of: 81 })
  rows.see('TurnDuration:t', null)
  expect(rows.anchor(43)).toEqual({ key: 'AssistantMessage:m', top: -2 })
})

test('a redrawn row keeps the order it was first seen in', async () => {
  const rows = new Rows()
  rows.see('UserMessage:u', { first: 0, last: 2, of: 3 })
  rows.see('AssistantMessage:m', { first: 0, last: 9, of: 10 })
  rows.see('UserMessage:u', { first: 1, last: 2, of: 3 })
  expect(rows.anchor(12)).toEqual({ key: 'AssistantMessage:m', top: -2 })
})

test('a single row taller than the screen: the drawer starts where its visible part does', async () => {
  const rows = new Rows()
  rows.see('AssistantMessage:m', { first: 30, last: 95, of: 120 })
  expect(rows.anchor(66)).toEqual({ key: 'AssistantMessage:m', top: 30 })
})
