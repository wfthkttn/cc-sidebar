import { expect, test } from 'claude-code/testing'

import { barCells, buttonBadge, GAUGE_COLUMNS_MAX, railLayout, targetAt } from '../hooks/rail'

const TOOLS = [
  { id: 'pass', icon: '🔐', short: 'pass', badge: { count: 3, level: 'urgent' as const } },
  { id: 'map', icon: '🗺', short: 'map' },
]
const SWITCHES = [{ id: 'diff', short: 'diff', isOn: true }]

test('drawn in, the strip is its 5-row button alone', async () => {
  expect(railLayout({ tools: TOOLS, switches: SWITCHES, isOpen: false }).map(r => r.kind)).toEqual(['button', 'button', 'button', 'button', 'button'])
})

test('drawn out: the button, the first tool tab right under it, a gap before each next, then the switches', async () => {
  expect(railLayout({ tools: TOOLS, switches: SWITCHES, isOpen: true }).map(r => r.kind)).toEqual([
    'button', 'button', 'button', 'button', 'button',
    'tab', 'tab', 'tab', 'tab',
    'blank', 'tab', 'tab', 'tab', 'tab',
    'blank', 'switch',
  ])
})

test('every row of the button and of a tab takes the click; blanks take none', async () => {
  const props = { tools: TOOLS, switches: SWITCHES, isOpen: true }
  for (const y of [0, 1, 2, 3, 4]) expect(targetAt(props, y)).toEqual({ kind: 'button' })
  for (const y of [5, 6, 7, 8]) expect(targetAt(props, y)).toEqual({ kind: 'tool', id: 'pass' })
  expect(targetAt(props, 9)).toBe(null)
  expect(targetAt(props, 10)).toEqual({ kind: 'tool', id: 'map' })
  expect(targetAt(props, 15)).toEqual({ kind: 'switch', id: 'diff' })
  expect(targetAt(props, 40)).toBe(null)
  for (const y of [0, 4]) expect(targetAt({ ...props, isOpen: false }, y)).toEqual({ kind: 'button' })
})

test('gauge bars fill from the bottom in eighths; anything above 0 shows', async () => {
  expect(barCells(70, 3)).toEqual(['▁', '█', '█'])
  expect(barCells(40, 3)).toEqual([' ', '▂', '█'])
  expect(barCells(0, 3)).toEqual([' ', ' ', ' '])
  expect(barCells(0.1, 3)).toEqual([' ', ' ', '▁'])
  expect(barCells(100, 3)).toEqual(['█', '█', '█'])
})

test('a gauge takes a tab\'s rows and a click on it is a click on the tab; 3 columns fit beside the bracket', async () => {
  const gauge = [{ letter: 'C', colors: ['#d97757', '#8f4a35'] as [string, string], values: [70, 40] as [number, number], isDim: false }]
  const props = { tools: [{ id: 'quota', icon: 'q', short: 'q', gauge }], switches: [], isOpen: true }
  expect(railLayout(props).map(r => r.kind)).toEqual(['button', 'button', 'button', 'button', 'button', 'tab', 'tab', 'tab', 'tab'])
  for (const y of [5, 6, 7, 8]) expect(targetAt(props, y)).toEqual({ kind: 'tool', id: 'quota' })
  expect(GAUGE_COLUMNS_MAX).toBe(3)
})

test("the button's badge sums the tools' counts at the loudest level; none without badges", async () => {
  const quiet = [
    { id: 'a', icon: 'a', short: 'a', badge: { count: 2, level: 'info' as const } },
    { id: 'b', icon: 'b', short: 'b', badge: { count: 1, level: 'attention' as const } },
    { id: 'c', icon: 'c', short: 'c' },
  ]
  expect(buttonBadge(quiet)).toEqual({ count: 3, level: 'attention' })
  expect(buttonBadge(TOOLS)).toEqual({ count: 3, level: 'urgent' })
  expect(buttonBadge([{ id: 'c', icon: 'c', short: 'c' }])).toBe(undefined)
})
