import type { ClientModule } from 'claude-code'

import type { SidebarBadgeLevel, SidebarGaugeColumn } from '../types/index'
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
const GAUGE_LOW = '#ef5350'
/** A bar this low or lower is drawn red. */
const GAUGE_LOW_FROM = 10
/** Two cells per column inside a tab's frame. */
export const GAUGE_COLUMNS_MAX = Math.floor(TAB_INNER / 2)
const GAUGE_BAR_ROWS = 3
/** Quietest first. */
const LEVELS: readonly SidebarBadgeLevel[] = ['info', 'attention', 'urgent']
const LEVEL_COLORS: Record<SidebarBadgeLevel, string> = { info: '#5b9bf0', attention: '#f2b134', urgent: '#ef5350' }

type Part = 'top' | 'upper' | 'middle' | 'lower' | 'bottom'
const TAB_PARTS: readonly Part[] = ['top', 'upper', 'lower', 'bottom']
const BUTTON_PARTS: readonly Part[] = ['top', 'upper', 'middle', 'lower', 'bottom']

type RailRow =
  | { kind: 'button'; part: Part }
  | { kind: 'tab'; part: Part; id: string }
  /** A gauge's row: 0 its top border, then its bar rows, then its bottom border holding the letters. */
  | { kind: 'gauge'; index: number; id: string }
  | { kind: 'switch'; id: string }

type Target = { kind: 'button' } | { kind: 'tool' | 'switch'; id: string }

type Shown = Pick<RailProps, 'tools' | 'switches' | 'isOpen'>

/** The tools as their tabs stack: by `order`, ties as they registered. */
export function inOrder<T extends { order?: number }>(tools: readonly T[]): T[] {
  return [...tools].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function railLayout(props: Shown): RailRow[] {
  const rows: RailRow[] = BUTTON_PARTS.map(part => ({ kind: 'button', part }))
  if (!props.isOpen) return rows
  for (const tool of props.tools) {
    if (tool.gauge === undefined) rows.push(...TAB_PARTS.map(part => ({ kind: 'tab' as const, part, id: tool.id })))
    else rows.push(...Array.from({ length: GAUGE_BAR_ROWS + 2 }, (_, index) => ({ kind: 'gauge' as const, index, id: tool.id })))
  }
  for (const sw of props.switches) rows.push({ kind: 'switch', id: sw.id })
  return rows
}

export function targetAt(props: Shown, y: number): Target | null {
  const row = railLayout(props)[y]
  if (row === undefined) return null
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

const EIGHTHS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
/**
 * By the left half's fill of a cell, then the right half's, in quarters from the bottom: octants (Unicode 16) where
 * the pattern has no older character.
 */
const HALVES: readonly (readonly string[])[] = [
  [' ', '\u{1CEA0}', '▗', '\u{1CD96}', '▐'],
  ['\u{1CEA3}', '▂', '\u{1CDCB}', '\u{1CDD3}', '\u{1CDD5}'],
  ['▖', '\u{1CDBB}', '▄', '\u{1CDE1}', '▟'],
  ['\u{1CD48}', '\u{1CDBF}', '\u{1CDDE}', '▆', '\u{1CDE5}'],
  ['▌', '\u{1CDC0}', '▙', '\u{1CDE4}', '█'],
]

/** The fill of each of `rows` cells, top cell first, in `perRow` steps a cell; 0 is empty, anything above shows a step. */
function fills(percent: number, rows: number, perRow: number): number[] {
  const steps = rows * perRow
  const level = percent <= 0 ? 0 : Math.max(1, Math.min(steps, Math.round((percent / 100) * steps)))
  return Array.from({ length: rows }, (_, i) => Math.max(0, Math.min(perRow, level - (rows - 1 - i) * perRow)))
}

/** A bar `rows` cells tall filled from the bottom, top cell first; 0 is blank, anything above shows at least an eighth. */
export function barCells(percent: number, rows: number): string[] {
  return fills(percent, rows, 8).map(f => EIGHTHS[f]!)
}

/** Two half-width bars sharing cells, filled from the bottom in quarter cells, top cell first. */
export function splitCells(left: number, right: number, rows: number): string[] {
  const rights = fills(right, rows, 4)
  return fills(left, rows, 4).map((l, i) => HALVES[l]![rights[i]!]!)
}

/** The full-width form of a printable ASCII character, two cells wide: it spans a gauge column's pair of bars. */
export function fullWidth(ch: string): string {
  const code = ch.codePointAt(0)!
  return code >= 0x21 && code <= 0x7e ? String.fromCodePoint(code + 0xfee0) : ch
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

  /** A gauge is framed as a tab is, its bars inside, each column's letter set full-width in the bottom border under its pair. */
  const gaugeRow = (id: string, columns: SidebarGaugeColumn[], index: number) => {
    const edge = tabLook(id).edge
    const spare = TAB_INNER - 2 * columns.length
    if (index === 0) return Text({ color: edge, children: ['╭' + '─'.repeat(TAB_INNER) + '╮'] })
    if (index === GAUGE_BAR_ROWS + 1) {
      return Text({
        children: [
          Text({ color: edge, children: ['╰'] }),
          ...columns.map(c => Text({ color: c.colors[0], bold: true, dimColor: c.isDim, children: [fullWidth(c.isDim ? '?' : c.letter)] })),
          Text({ color: edge, children: ['─'.repeat(spare) + '╯'] }),
        ],
      })
    }
    const row = index - 1
    return Text({
      children: [
        Text({ color: edge, children: ['│'] }),
        ...columns.flatMap(c =>
          c.values.map((value, bar) => {
            // Nothing left still shows, as a red sliver: blank is for no value.
            const shown = (v: number | null) => (v === null ? 0 : Math.max(v, 0.1))
            const cells = Array.isArray(value) ? splitCells(shown(value[0]), shown(value[1]), GAUGE_BAR_ROWS) : barCells(shown(value), GAUGE_BAR_ROWS)
            const isLow = [value].flat().some(v => v !== null && v <= GAUGE_LOW_FROM)
            const color = isLow ? GAUGE_LOW : c.colors[bar]!
            return Text({ color, dimColor: c.isDim, children: [cells[row]!] })
          }),
        ),
        Text({ children: [' '.repeat(spare)] }),
        Text({ color: edge, children: ['│'] }),
      ],
    })
  }

  const rows = railLayout(props).map(row => {
    switch (row.kind) {
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
        return frame(row.part, look, [Text({ color: look.text, bold: true, children: [isIcon ? tool.icon : tool.short.toUpperCase()] })])
      }
      case 'gauge':
        return gaugeRow(row.id, toolsById.get(row.id)!.gauge!, row.index)
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
