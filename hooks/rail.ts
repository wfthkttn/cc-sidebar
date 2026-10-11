import type { ClientModule } from 'claude-code'

import type { RailProps } from './rail-props'

/**
 * The rail draws at the right edge of the dock, VISIBLE_COLUMNS wide with its
 * own edge line, and leaves the rest of the dock in the terminal's background
 * so it reads as transcript space.
 */
const VISIBLE_COLUMNS = 14
/** Blank columns between the content and the edge line, and the dock's right side. */
const PAD_X = 1
const PAD_TOP = 2
/** A tool's row: its tab is TAB_ROWS tall, then one blank row before the next. */
const TAB_ROWS = 2
const ROW_PITCH = TAB_ROWS + 1
const TAB_COLUMNS = 6
const BADGE_COLUMNS = 4
/** A switch pill: its dot and a short name padded to 4. */
const SWITCH_COLUMNS = 5

const COLORS = {
  /** The terminal's own background (WezTerm "Builtin Tango Dark"), painted over the dock's grey. */
  rail: '#000000',
  edge: '#3a4252',
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

type Hover = { kind: 'tool' | 'switch'; id: string } | null
type State = { hover: Hover }

/** The props of the last draw: the pointer listener, set once, hit-tests against these. */
let latest: RailProps = { tools: [], switches: [], selected: null }

const Rail: ClientModule<RailProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.onPointer(p => {
      const target = targetAt(latest, surface.rows, surface.columns, p.x, p.y)
      if (p.type === 'down' && p.button === 'left' && target) {
        surface.post({ press: target.kind + ':' + target.id })
      }
      const hover = p.type === 'leave' ? null : target
      const prev = surface.state?.hover ?? null
      if (prev?.kind !== hover?.kind || prev?.id !== hover?.id) surface.setState({ hover })
    })
    surface.setState({ hover: null })
  }
  latest = props
  const hover = surface.state?.hover ?? null
  const contentColumns = VISIBLE_COLUMNS - 1 - 2 * PAD_X

  const toolRows = props.tools.map(tool => {
    const isSelected = tool.id === props.selected
    const isHovered = hover?.kind === 'tool' && hover.id === tool.id
    const tabColor = isSelected ? COLORS.tabSelected : isHovered ? COLORS.tabHover : COLORS.tab
    const textColor = isSelected ? COLORS.tabSelectedText : COLORS.tabText
    return Box({
      flexDirection: 'row',
      justifyContent: 'flex-end',
      height: TAB_ROWS,
      marginBottom: ROW_PITCH - TAB_ROWS,
      children: [
        Box({
          width: BADGE_COLUMNS,
          marginRight: 1,
          height: TAB_ROWS,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          ...(tool.badge ? { backgroundColor: COLORS[tool.badge.level] } : {}),
          children: tool.badge
            ? [Text({ color: COLORS.badgeText, bold: true, children: [tool.badge.count > 99 ? '99+' : String(tool.badge.count)] })]
            : [],
        }),
        Box({
          width: TAB_COLUMNS,
          height: TAB_ROWS,
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: tabColor,
          children: [
            Text({ color: textColor, bold: true, children: [tool.icon] }),
            Text({ color: textColor, children: [tool.short] }),
          ],
        }),
      ],
    })
  })

  const switchRows = []
  for (let at = 0; at < props.switches.length; at += 2) {
    switchRows.push(
      Box({
        flexDirection: 'row',
        gap: 1,
        children: props.switches.slice(at, at + 2).map(sw => {
          const isHovered = hover?.kind === 'switch' && hover.id === sw.id
          return Text({
            backgroundColor: sw.isOn ? COLORS.switchOn : COLORS.switchOff,
            color: sw.isOn ? COLORS.switchOnText : COLORS.switchOffText,
            bold: isHovered,
            underline: isHovered,
            children: [(sw.isOn ? '●' : '○') + sw.short.padEnd(SWITCH_COLUMNS - 1)],
          })
        }),
      }),
    )
  }

  return Box({
    flexDirection: 'row',
    width: surface.columns,
    height: surface.rows,
    backgroundColor: COLORS.rail,
    children: [
      Box({ width: Math.max(0, surface.columns - VISIBLE_COLUMNS) }),
      Box({
        width: 1,
        height: surface.rows,
        children: [Text({ color: COLORS.edge, children: [Array(surface.rows).fill('│').join('\n')] })],
      }),
      Box({
        width: contentColumns,
        height: surface.rows,
        marginLeft: PAD_X,
        marginRight: PAD_X,
        paddingTop: PAD_TOP,
        flexDirection: 'column',
        justifyContent: 'space-between',
        children: [
          Box({ flexDirection: 'column', children: toolRows }),
          Box({ flexDirection: 'column', children: switchRows }),
        ],
      }),
    ],
  })
}

function targetAt(props: RailProps, rows: number, columns: number, x: number, y: number): Hover {
  const left = columns - VISIBLE_COLUMNS + 1 + PAD_X
  if (x < left || y < 0 || x >= columns - PAD_X || y >= rows) return null
  const fromTop = y - PAD_TOP
  const index = Math.floor(fromTop / ROW_PITCH)
  const tool = fromTop >= 0 && fromTop % ROW_PITCH < TAB_ROWS ? props.tools[index] : undefined
  if (tool !== undefined) return { kind: 'tool', id: tool.id }
  const switchRowCount = Math.ceil(props.switches.length / 2)
  const switchRow = y - (rows - switchRowCount)
  if (switchRow >= 0) {
    const sw = props.switches[switchRow * 2 + (x - left < SWITCH_COLUMNS + 1 ? 0 : 1)]
    if (sw) return { kind: 'switch', id: sw.id }
  }
  return null
}

export default Rail
