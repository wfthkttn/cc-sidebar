import { expect, test } from 'claude-code/testing'

const KEPT = {
  tools: [{ id: 'pass', icon: '🔐', short: 'pass', drawerColumns: 52 }],
  badges: {},
  switches: [],
  selected: null,
  isOpen: true,
}

/** A tool's plugin: registers on a command, and reads the rail the sidebar kept. */
const tool = {
  name: 'tool',
  register(on: any) {
    // a literal: an inline plugin sees nothing of this file
    on('command.run', { command: 'tool-register' }, async ($: any) => {
      await $.sidebar.register({ id: 'quota', icon: 'q', short: 'q', order: 1 })
      return { text: '' }
    })
    on('command.run', { command: 'tool-rail' }, async ($: any) => {
      return { text: JSON.stringify((await $.state.get({ plugin: 'sidebar', key: 'rail' })).value) }
    })
  },
}

test("a tool registering before this load's session start keeps the tabs an earlier load kept", { plugins: [tool] }, async ($, onTyped) => {
  const on = onTyped as any
  let isWritten = false
  // what an earlier load of the sidebar kept, until this load writes its own
  on('state.get', ($$: unknown, e: { plugin: string; key: string }, next: (e: unknown) => unknown) =>
    e.plugin === 'sidebar' && e.key === 'rail' && !isWritten ? { value: { value: KEPT } } : next(e),
  )
  on('state.set', ($$: unknown, e: { plugin: string; key: string }, next: (e: unknown) => unknown) => {
    if (e.plugin === 'sidebar' && e.key === 'rail') isWritten = true
    return next(e)
  })
  const run = (command: string) => ($ as any).command.run({ command, args: '' })
  await run('tool-register')
  const rail = JSON.parse((await run('tool-rail')).text)
  expect(rail.tools.map((t: { id: string }) => t.id)).toEqual(['pass', 'quota'])
})
