import type { ClientModule } from 'claude-code'

import type { RailProps } from './rail-props'

/** A tab: two inner rows inside a border, about square on screen; the draw-in button has three. */
const TAB_INNER = 6
const TAB_COLUMNS = TAB_INNER + 2
/** The strip's width, drawn in or out; its tabs end on the transcript's last column. */
export const RAIL_COLUMNS = TAB_COLUMNS

const COLORS = {
  rail: '#000000',
  edge: '#3a4252',
  button: '#d97757',
  buttonHover: '#5a3324',
  buttonText: '#ffd9c7',
  tab: '#24324a',
  tabHover: '#33496b',
  tabSelected: '#d97757',
  tabText: '#e8ecf4',
  tabSelectedText: '#1b1b1b',
  badgeText: '#111111',
  info: '#5b9bf0',
  attention: '#f2b134',
  urgent: '#ef5350',
  switchOn: '#2f7d55',
  switchOff: '#30343c',
  switchOnText: '#f0fff6',
  switchOffText: '#9aa1ad',
}

type Part = 'top' | 'upper' | 'middle' | 'lower' | 'bottom'
const PARTS: readonly Part[] = ['top', 'upper', 'lower', 'bottom']
const BUTTON_PARTS: readonly Part[] = ['top', 'upper', 'middle', 'lower', 'bottom']

export type RailRow =
  | { kind: 'button'; part: Part }
  | { kind: 'blank' }
  | { kind: 'tab'; part: Part; id: string }
  | { kind: 'switch'; id: string }

export type Target = { kind: 'button' } | { kind: 'tool' | 'switch'; id: string }

type Shown = Pick<RailProps, 'tools' | 'switches' | 'isOpen'>

export function railLayout(props: Shown): RailRow[] {
  const rows: RailRow[] = BUTTON_PARTS.map(part => ({ kind: 'button', part }))
  if (!props.isOpen) return rows
  for (const tool of props.tools) {
    rows.push({ kind: 'blank' }, ...PARTS.map(part => ({ kind: 'tab' as const, part, id: tool.id })))
  }
  if (props.switches.length > 0) rows.push({ kind: 'blank' })
  for (const sw of props.switches) rows.push({ kind: 'switch', id: sw.id })
  return rows
}

export function targetAt(props: Shown, y: number): Target | null {
  const row = railLayout(props)[y]
  if (row === undefined || row.kind === 'blank') return null
  if (row.kind === 'button') return { kind: 'button' }
  if (row.kind === 'switch') return { kind: 'switch', id: row.id }
  return { kind: 'tool', id: row.id }
}

function countText(count: number): string {
  return count > 99 ? '99+' : String(count)
}

type State = { hover: Target | null }

function same(a: Target | null, b: Target | null): boolean {
  if (a === null || b === null) return a === b
  return a.kind === b.kind && (a.kind === 'button' || a.id === (b as { id: string }).id)
}

/** The props of the last draw: the pointer listener, set once, hit-tests against these. */
let latest: RailProps = { tools: [], switches: [], selected: null, isOpen: false }

const Rail: ClientModule<RailProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.onPointer(p => {
      const target = p.type === 'leave' ? null : targetAt(latest, p.y)
      if (p.type === 'down' && p.button === 'left' && target) {
        surface.post({ press: target.kind === 'button' ? 'handle' : target.kind + ':' + target.id })
      }
      if (!same(surface.state?.hover ?? null, target)) surface.setState({ hover: target })
    })
    surface.setState({ hover: null })
  }
  latest = props
  const hover = surface.state?.hover ?? null
  const byId = new Map(props.tools.map(t => [t.id, t]))
  const switches = new Map(props.switches.map(s => [s.id, s]))
  const total = props.tools.reduce((sum, t) => sum + (t.badge?.count ?? 0), 0)

  type Look = { edge: string; body?: string; text: string }
  const frame = (part: Part, look: Look, inner: ReturnType<typeof Text>[]) => {
    if (part === 'top' || part === 'bottom') {
      const [left, right] = part === 'top' ? ['╭', '╮'] : ['╰', '╯']
      return Text({ color: look.edge, children: [left, ...inner, right] })
    }
    return Box({
      flexDirection: 'row',
      width: TAB_COLUMNS,
      children: [
        Text({ color: look.edge, children: ['│'] }),
        Box({ width: TAB_INNER, justifyContent: 'center', ...(look.body === undefined ? {} : { backgroundColor: look.body }), children: inner }),
        Text({ color: look.edge, children: ['│'] }),
      ],
    })
  }
  const rule = (look: Look) => Text({ color: look.edge, children: ['─'.repeat(TAB_INNER)] })
  const topBorder = (look: Look, badge: { count: number; level: keyof typeof COLORS } | undefined) => {
    if (badge === undefined) return frame('top', look, [rule(look)])
    const text = ` ${countText(badge.count)} `
    return Text({
      color: look.edge,
      children: [
        Text({ color: COLORS.badgeText, backgroundColor: COLORS[badge.level], bold: true, children: [text] }),
        '─'.repeat(TAB_COLUMNS - 1 - text.length) + '╮',
      ],
    })
  }

  const buttonLook: Look = {
    edge: COLORS.button,
    ...(hover?.kind === 'button' ? { body: COLORS.buttonHover } : {}),
    text: COLORS.buttonText,
  }
  const tabLook = (id: string): Look => {
    const isSelected = id === props.selected
    const isHovered = hover?.kind === 'tool' && hover.id === id
    return {
      edge: isSelected ? COLORS.tabSelected : isHovered ? COLORS.tabHover : COLORS.edge,
      body: isSelected ? COLORS.tabSelected : isHovered ? COLORS.tabHover : COLORS.tab,
      text: isSelected ? COLORS.tabSelectedText : COLORS.tabText,
    }
  }

  const rows = railLayout(props).map(row => {
    switch (row.kind) {
      case 'blank':
        return Text({ children: [' '.repeat(TAB_COLUMNS)] })
      case 'button': {
        if (row.part === 'top') return topBorder(buttonLook, total > 0 ? { count: total, level: 'urgent' } : undefined)
        if (row.part === 'bottom') return frame('bottom', buttonLook, [rule(buttonLook)])
        if (row.part === 'middle') {
          return frame('middle', buttonLook, [Text({ color: buttonLook.text, bold: true, children: [props.isOpen ? '＞' : '＜'] })])
        }
        return frame(row.part, buttonLook, [])
      }
      case 'tab': {
        const tool = byId.get(row.id)!
        const look = tabLook(row.id)
        if (row.part === 'top') return topBorder(look, tool.badge)
        if (row.part === 'bottom') return frame('bottom', look, [rule(look)])
        const isIcon = row.part === 'upper'
        return frame(row.part, look, [Text({ color: look.text, bold: isIcon, children: [isIcon ? tool.icon : tool.short] })])
      }
      case 'switch': {
        const sw = switches.get(row.id)!
        const isHovered = hover?.kind === 'switch' && hover.id === sw.id
        return Box({
          width: TAB_COLUMNS,
          justifyContent: 'center',
          backgroundColor: sw.isOn ? COLORS.switchOn : COLORS.switchOff,
          children: [
            Text({
              color: sw.isOn ? COLORS.switchOnText : COLORS.switchOffText,
              bold: isHovered,
              underline: isHovered,
              children: [(sw.isOn ? '●' : '○') + sw.short],
            }),
          ],
        })
      }
    }
  })
  return Box({ flexDirection: 'column', width: RAIL_COLUMNS, backgroundColor: COLORS.rail, children: rows })
}

export default Rail
