import type { ClientModule } from 'claude-code'

import type { SidebarBadgeLevel } from '../types/index'
import type { RailBadge, RailProps } from './rail-props'

/** Inner columns of a tab: with its two inner rows, about square on screen. */
const TAB_INNER = 6
const TAB_COLUMNS = TAB_INNER + 2
/** The strip's width, drawn in or out. */
export const RAIL_COLUMNS = TAB_COLUMNS

const ACCENT = '#d97757'
const COLORS = {
  rail: '#000000',
  edge: '#3a4252',
  button: ACCENT,
  buttonHover: '#5a3324',
  buttonText: '#ffd9c7',
  tab: '#24324a',
  tabHover: '#33496b',
  tabSelected: ACCENT,
  tabText: '#e8ecf4',
  tabSelectedText: '#1b1b1b',
  badgeText: '#111111',
  switchOn: '#2f7d55',
  switchOff: '#30343c',
  switchOnText: '#f0fff6',
  switchOffText: '#9aa1ad',
}
/** Quietest first. */
const LEVELS: readonly SidebarBadgeLevel[] = ['info', 'attention', 'urgent']
const LEVEL_COLORS: Record<SidebarBadgeLevel, string> = { info: '#5b9bf0', attention: '#f2b134', urgent: '#ef5350' }

type Part = 'top' | 'upper' | 'middle' | 'lower' | 'bottom'
const TAB_PARTS: readonly Part[] = ['top', 'upper', 'lower', 'bottom']
const BUTTON_PARTS: readonly Part[] = ['top', 'upper', 'middle', 'lower', 'bottom']

type RailRow =
  | { kind: 'button'; part: Part }
  | { kind: 'blank' }
  | { kind: 'tab'; part: Part; id: string }
  | { kind: 'switch'; id: string }

type Target = { kind: 'button' } | { kind: 'tool' | 'switch'; id: string }

type Shown = Pick<RailProps, 'tools' | 'switches' | 'isOpen'>

export function railLayout(props: Shown): RailRow[] {
  const rows: RailRow[] = BUTTON_PARTS.map(part => ({ kind: 'button', part }))
  if (!props.isOpen) return rows
  props.tools.forEach((tool, index) => {
    if (index > 0) rows.push({ kind: 'blank' })
    rows.push(...TAB_PARTS.map(part => ({ kind: 'tab' as const, part, id: tool.id })))
  })
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

/** The button's badge: every tool's count, at the loudest of their levels. */
export function buttonBadge(tools: RailProps['tools']): RailBadge | undefined {
  const badges = tools.flatMap(t => (t.badge === undefined ? [] : [t.badge]))
  if (badges.length === 0) return undefined
  return {
    count: badges.reduce((sum, b) => sum + b.count, 0),
    level: LEVELS[Math.max(...badges.map(b => LEVELS.indexOf(b.level)))]!,
  }
}

function countText(count: number): string {
  return count > 99 ? '99+' : String(count)
}

type State = { hover: Target | null }

function same(a: Target | null, b: Target | null): boolean {
  if (a === null || b === null) return a === b
  if (a.kind === 'button' || b.kind === 'button') return a.kind === b.kind
  return a.kind === b.kind && a.id === b.id
}

/** The props of the last draw: the pointer listener, set once, hit-tests against these. */
let latest: RailProps = { tools: [], switches: [], selected: null, isOpen: false }

const Rail: ClientModule<RailProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.onPointer(p => {
      const target = p.type === 'leave' ? null : targetAt(latest, p.y)
      if (p.type === 'down' && p.button === 'left' && target) {
        surface.post({ press: target.kind === 'button' ? 'toggle' : target.kind + ':' + target.id })
      }
      if (!same(surface.state?.hover ?? null, target)) surface.setState({ hover: target })
    })
    surface.setState({ hover: null })
  }
  latest = props
  const hover = surface.state?.hover ?? null
  const toolsById = new Map(props.tools.map(t => [t.id, t]))
  const switchesById = new Map(props.switches.map(s => [s.id, s]))

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
  const topBorder = (look: Look, badge: RailBadge | undefined) => {
    if (badge === undefined) return frame('top', look, [rule(look)])
    const text = ` ${countText(badge.count)} `
    return Text({
      color: look.edge,
      children: [
        Text({ color: COLORS.badgeText, backgroundColor: LEVEL_COLORS[badge.level], bold: true, children: [text] }),
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
        if (row.part === 'top') return topBorder(buttonLook, buttonBadge(props.tools))
        if (row.part === 'bottom') return frame('bottom', buttonLook, [rule(buttonLook)])
        if (row.part === 'middle') {
          return frame('middle', buttonLook, [Text({ color: buttonLook.text, bold: true, children: [props.isOpen ? '＞' : '＜'] })])
        }
        return frame(row.part, buttonLook, [])
      }
      case 'tab': {
        const tool = toolsById.get(row.id)!
        const look = tabLook(row.id)
        if (row.part === 'top') return topBorder(look, tool.badge)
        if (row.part === 'bottom') return frame('bottom', look, [rule(look)])
        const isIcon = row.part === 'upper'
        return frame(row.part, look, [Text({ color: look.text, bold: isIcon, children: [isIcon ? tool.icon : tool.short] })])
      }
      case 'switch': {
        const sw = switchesById.get(row.id)!
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
              children: [(sw.isOn ? '● ' : '○ ') + sw.short],
            }),
          ],
        })
      }
    }
  })
  return Box({ flexDirection: 'column', width: TAB_COLUMNS, backgroundColor: COLORS.rail, children: rows })
}

export default Rail
