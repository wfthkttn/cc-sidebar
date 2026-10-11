import type { On } from 'claude-code'

const switchStates = new Map<string, boolean>([
  ['rc', true],
  ['diff', false],
  ['bm', false],
])

export function register(on: On) {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.sidebar.register({ id: 'ask', icon: '❓', short: 'ask' })
    await $.sidebar.register({ id: 'pass', icon: '🔑', short: 'pass' })
    await $.sidebar.register({ id: 'vault', icon: '🔐', short: 'vlt' })
    await $.sidebar.badge({ id: 'ask', count: 2, level: 'attention' })
    await $.sidebar.badge({ id: 'pass', count: 1, level: 'urgent' })
    for (const [id, isOn] of switchStates) {
      await $.sidebar.setSwitch({ id, short: id, isOn })
    }
    await $.command.register({ name: 'demo-badge', description: 'demo: /demo-badge <tool> <count> [level]' })
    return started
  })

  on('sidebar.press', async ($, e, next) => {
    if (e.element === 'tool:ask') await $.ui.toast('Questions pressed')
    const sw = e.element.startsWith('switch:') ? e.element.slice('switch:'.length) : null
    if (sw !== null && switchStates.has(sw)) {
      const isOn = !switchStates.get(sw)
      switchStates.set(sw, isOn)
      await $.sidebar.setSwitch({ id: sw, short: sw, isOn })
    }
    return next(e)
  })

  on('command.run', { command: 'demo-badge' }, async ($, e) => {
    const [id, count, level] = e.args.trim().split(/\s+/)
    await $.sidebar.badge({
      id,
      count: Number(count),
      level: level === 'urgent' || level === 'info' ? level : 'attention',
    })
    return {}
  })
}
