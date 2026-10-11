import { expect, test } from 'claude-code/testing'

import { railLayout, targetAt } from '../hooks/rail'

const TOOLS = [
  { id: 'pass', icon: '🔐', short: 'pass', badge: { count: 3, level: 'urgent' as const } },
  { id: 'map', icon: '🗺', short: 'map' },
]
const SWITCHES = [{ id: 'diff', short: 'diff', isOn: true }]

test('drawn in, the strip is its 5-row button alone', async () => {
  expect(railLayout({ tools: TOOLS, switches: SWITCHES, isOpen: false }).map(r => r.kind)).toEqual(['button', 'button', 'button', 'button', 'button'])
})

test('drawn out: the button, then a 4-row tab per tool, then the switches', async () => {
  expect(railLayout({ tools: TOOLS, switches: SWITCHES, isOpen: true }).map(r => r.kind)).toEqual([
    'button', 'button', 'button', 'button', 'button',
    'blank', 'tab', 'tab', 'tab', 'tab',
    'blank', 'tab', 'tab', 'tab', 'tab',
    'blank', 'switch',
  ])
})

test('every row of the button and of a tab takes the click; blanks take none', async () => {
  const props = { tools: TOOLS, switches: SWITCHES, isOpen: true }
  for (const y of [0, 1, 2, 3, 4]) expect(targetAt(props, y)).toEqual({ kind: 'button' })
  expect(targetAt(props, 5)).toBe(null)
  for (const y of [6, 7, 8, 9]) expect(targetAt(props, y)).toEqual({ kind: 'tool', id: 'pass' })
  expect(targetAt(props, 11)).toEqual({ kind: 'tool', id: 'map' })
  expect(targetAt(props, 16)).toEqual({ kind: 'switch', id: 'diff' })
  expect(targetAt(props, 40)).toBe(null)
  for (const y of [0, 4]) expect(targetAt({ ...props, isOpen: false }, y)).toEqual({ kind: 'button' })
})
