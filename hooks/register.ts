import type { EngineInterface, On } from 'claude-code'

import type { Sidebar, SidebarDrawerSlot, SidebarPopoutSlot, SidebarRail, SidebarTool } from '../types/index'
import { GAUGE_COLUMNS_MAX, RAIL_COLUMNS, railLayout } from './rail'
import type { RailMessage, RailProps } from './rail-props'
import { ROW_COMPONENTS, Rows, rowKey } from './rows'

const SHORT_MAX = 4
const DRAWER_MIN_COLUMNS = 20
const DRAWER_BACKGROUND = '#11161f'
const DRAWER_PADDING = 1
/** Border and padding on both sides. */
const DRAWER_FRAME_COLUMNS = 2 + 2 * DRAWER_PADDING
/** Top border, title row, bottom border. */
const DRAWER_FRAME_ROWS = 3
/** Fullscreen moves a box placed above the screen to the transcript's top row; renderer behaviour the mod types don't promise. */
const VIEWPORT_TOP = -10000
const EMPTY: SidebarRail = { tools: [], badges: {}, switches: [], selected: null, isOpen: true }

type DrawerTool = SidebarTool & { drawerColumns: number }

/**
 * Kept twice: `$.state` survives a module reload but not `/clear`, `/resume`
 * or `/branch`; this variable the reverse. Each restores the other.
 */
let rail: SidebarRail = EMPTY
const transcript = new Rows()
/** The row the overlays were last drawn from. */
let placed: string | null = null
/** The terminal's rows and the band's room above the prompt, as the band last drew; null outside fullscreen. */
let band: { rows: number; maxRows: number } | null = null
/** Tools whose pop-out area is shown; tools say so again after a reload. */
const popouts = new Set<string>()
type Hold = { row: string; tools: ReadonlySet<string> }
/** The row the overlays stay on while a tool holds them, besides the anchor (`$.sidebar.hold`), and the tools holding. */
let held: Hold | null = null

async function save($: Pick<EngineInterface, 'state' | 'ui'>, edit: (now: SidebarRail) => SidebarRail) {
  rail = edit(rail)
  await $.state.set({ plugin: 'sidebar', key: 'rail' }, rail)
  $.ui.invalidate('ui.render')
}

function upsert<T extends { id: string }>(list: T[], entry: T): T[] {
  return list.some(item => item.id === entry.id) ? list.map(item => (item.id === entry.id ? entry : item)) : [...list, entry]
}

function checkShort(what: string, short: string) {
  if (short.length === 0 || short.length > SHORT_MAX) {
    throw new Error(`sidebar: ${what} short name "${short}" must be 1-${SHORT_MAX} characters`)
  }
}

function drawerSlotKey(toolId: string): SidebarDrawerSlot {
  return `sidebar-drawer:${toolId}`
}

function popoutSlotKey(toolId: string): SidebarPopoutSlot {
  return `sidebar-popout:${toolId}`
}

/** The transcript's rows on screen; null outside fullscreen or before the band first draws. */
function transcriptRows(): number | null {
  // The bottom slot (band, prompt, footer) is capped at half the terminal; `maxRows` is what the prompt and footer leave of it.
  return band === null ? null : band.rows - (Math.floor(band.rows / 2) - band.maxRows)
}

function hasDrawer(tool: SidebarTool): tool is DrawerTool {
  return tool.drawerColumns !== undefined
}

function openDrawer(): DrawerTool | null {
  const tool = rail.tools.find(t => t.id === rail.selected)
  return tool !== undefined && hasDrawer(tool) ? tool : null
}

function withoutTool(hold: Hold, id: string): Hold | null {
  const tools = new Set(hold.tools)
  tools.delete(id)
  return tools.size === 0 ? null : { row: hold.row, tools }
}

/** Tools with a pop-out shown, their drawer closed. */
function poppedOut(): DrawerTool[] {
  return rail.tools.filter(hasDrawer).filter(t => popouts.has(t.id) && t.id !== rail.selected)
}

export function register(on: On) {
  on('engine.create', async (_$, e, next) => {
    const beneath = await next(e)
    // `save` with `beneath` spelled out: the engine refuses next(e)'s value passed as an argument.
    const change = async (edit: (now: SidebarRail) => SidebarRail) => {
      rail = edit(rail)
      await beneath.state.set({ plugin: 'sidebar', key: 'rail' }, rail)
      beneath.ui.invalidate('ui.render')
    }
    const sidebar: Sidebar = {
      register: async tool => {
        checkShort(`tool "${tool.id}"`, tool.short)
        const { drawerColumns } = tool
        if (drawerColumns !== undefined && (!Number.isInteger(drawerColumns) || drawerColumns < DRAWER_MIN_COLUMNS)) {
          throw new Error(`sidebar: tool "${tool.id}" drawerColumns ${drawerColumns} must be an integer >= ${DRAWER_MIN_COLUMNS}`)
        }
        const entry = { id: tool.id, icon: tool.icon, short: tool.short, ...(drawerColumns === undefined ? {} : { drawerColumns }) }
        await change(now => ({ ...now, tools: upsert(now.tools, entry) }))
      },
      gauge: async ({ id, columns }) => {
        if (!rail.tools.some(t => t.id === id)) throw new Error(`sidebar: gauge for unregistered tool "${id}"`)
        if (columns !== null) {
          if (columns.length > GAUGE_COLUMNS_MAX) throw new Error(`sidebar: gauge for "${id}" has ${columns.length} columns, at most ${GAUGE_COLUMNS_MAX} fit`)
          const bad = columns.flatMap(c => c.values).find(v => v !== null && !(v >= 0 && v <= 100))
          if (bad !== undefined) throw new Error(`sidebar: gauge for "${id}" has the value ${bad}, outside 0-100`)
        }
        await change(now => {
          const gauges = { ...now.gauges }
          if (columns === null) delete gauges[id]
          else gauges[id] = columns.map(c => ({ letter: c.letter, colors: [c.colors[0], c.colors[1]], values: [c.values[0], c.values[1]], isDim: c.isDim }))
          return { ...now, gauges }
        })
      },
      badge: async badge => {
        if (!rail.tools.some(t => t.id === badge.id)) {
          throw new Error(`sidebar: badge for unregistered tool "${badge.id}"`)
        }
        if (!Number.isInteger(badge.count) || badge.count < 0) {
          throw new Error(`sidebar: badge count ${badge.count} for "${badge.id}" must be a non-negative integer`)
        }
        await change(now => {
          const badges = { ...now.badges }
          if (badge.count === 0) delete badges[badge.id]
          else badges[badge.id] = { ...badge }
          return { ...now, badges }
        })
      },
      setSwitch: async sw => {
        checkShort(`switch "${sw.id}"`, sw.short)
        await change(now => ({ ...now, switches: upsert(now.switches, { ...sw }) }))
      },
      selected: async () => rail.selected,
      select: async ({ id }) => {
        if (id !== null && !rail.tools.some(t => t.id === id)) {
          throw new Error(`sidebar: select of unregistered tool "${id}"`)
        }
        await change(now => ({ ...now, selected: id }))
      },
      press: async () => {},
      popout: async ({ id, isShown }) => {
        const tool = rail.tools.find(t => t.id === id)
        if (tool === undefined || !hasDrawer(tool)) {
          throw new Error(`sidebar: pop-out for "${id}", which is no registered tool with a drawer`)
        }
        if (popouts.has(id) === isShown) return
        if (isShown) popouts.add(id)
        else popouts.delete(id)
        beneath.ui.invalidate('ui.render')
      },
      room: async () => {
        const rows = transcriptRows()
        return rows === null ? null : { drawer: rows - DRAWER_FRAME_ROWS, popout: rows, drawerFrameColumns: DRAWER_FRAME_COLUMNS }
      },
      hold: async ({ id, isHeld }) => {
        if (!rail.tools.some(t => t.id === id)) {
          throw new Error(`sidebar: hold for unregistered tool "${id}"`)
        }
        const at = transcript.anchor()
        let now = held
        // With no row on screen nothing is drawn, so there is nothing to keep.
        if (isHeld && at !== null && held?.tools.has(id) !== true) now = { row: at, tools: new Set([...(held?.tools ?? []), id]) }
        else if (!isHeld && held !== null) now = withoutTool(held, id)
        if (now !== held) {
          held = now
          beneath.ui.invalidate('ui.render')
        }
        beneath.ui.log(`trace hold ${id} ${isHeld} anchor=${at} held=${held?.row ?? 'none'}`, { to: 'debug' })
      },
      mirrored: async ({ component, requestId }) => {
        const at = transcript.anchor()
        return held !== null && held.row !== at && rowKey(component, requestId) === at
      },
    }
    return { ...beneath, sidebar }
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const kept = (await $.state.get({ plugin: 'sidebar', key: 'rail' })).value
    if (kept !== undefined && rail.tools.length === 0 && rail.switches.length === 0) rail = kept
    await $.command.register({
      name: 'sidebar',
      description: 'Hide the sidebar, or show it again',
      immediate: true,
    })
    return started
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await save($, now => now)
    transcript.clear()
    held = null
    return next(e)
  })

  on('command.run', { command: 'sidebar' }, async $ => {
    await save($, ({ isHidden, ...now }) => (isHidden === true ? { ...now, isOpen: true } : { ...now, isHidden: true }))
    return {}
  })

  on('ui.message', { element: 'rail' }, async ($, e, next) => {
    const { press } = e.data as RailMessage
    if (press === 'toggle') {
      await save($, now => ({ ...now, isOpen: !now.isOpen }))
      return next(e)
    }
    if (press.startsWith('tool:')) {
      const id = press.slice('tool:'.length)
      await save($, now => ({ ...now, selected: now.selected === id ? null : id }))
    }
    await $.sidebar.press({ element: press })
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const now = e.viewport?.isFullscreen === true ? { rows: e.viewport.rows, maxRows: e.props.maxRows } : null
    if (now?.rows !== band?.rows || now?.maxRows !== band?.maxRows) {
      band = now
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('ui.render', { component: [...ROW_COMPONENTS] }, async ($, e, next) => {
    const engine = await next(e)
    // A prompt's row while it is sent; a slash command's vanishes without reporting it left the screen.
    if (e.surface !== 'terminal' || e.props.onScreen === undefined || e.requestId === 'placeholder') return engine
    const key = rowKey(e.component, e.requestId)
    transcript.see(key, e.props.onScreen !== null)
    if (rail.isHidden === true) return engine
    const at = transcriptRows() === null ? null : transcript.anchor()
    if (at !== placed) {
      $.ui.log(`trace anchor ${placed} -> ${at}`, { to: 'debug' })
      placed = at
      $.ui.invalidate('ui.render')
    }
    if (held !== null) {
      let kept: Hold | null = held
      for (const id of held.tools) {
        if (kept !== null && rail.selected !== id && !popouts.has(id)) kept = withoutTool(kept, id)
      }
      if (kept !== null && !transcript.isOnScreen(kept.row)) kept = null
      if (kept !== held) {
        $.ui.log(`trace hold dropped on ${held.row}: ${kept === null ? 'drawer closed or row off screen' : 'a tool closed'}`, { to: 'debug' })
        held = kept
        $.ui.invalidate('ui.render')
      }
    }
    // The held row draws exactly what the anchor does, the rail too, so its slots' instances outlive a move of the hold.
    const isHeldRow = held !== null && held.row === key
    if ((at !== key && !isHeldRow) || e.viewport === undefined) return engine
    const open = openDrawer()
    const popped = poppedOut()

    const { Box, Button, Client, Text } = $.ui.resolve(e)
    const props: RailProps = {
      tools: rail.tools.map(({ id, icon, short }) => {
        const badge = rail.badges[id]
        const gauge = rail.gauges?.[id]
        return {
          id,
          icon,
          short,
          ...(badge === undefined ? {} : { badge: { count: badge.count, level: badge.level } }),
          ...(gauge === undefined ? {} : { gauge }),
        }
      }),
      switches: rail.switches,
      selected: rail.selected,
      isOpen: rail.isOpen,
    }
    // From the left: a row's own box can be as narrow as its content (a running Bash call's is).
    const stripLeft = e.viewport.columns - RAIL_COLUMNS
    const popoutColumns = Math.max(0, ...popped.map(t => t.drawerColumns))
    return Box({
      flexDirection: 'column',
      children: [
        engine,
        Box({
          position: 'absolute',
          top: VIEWPORT_TOP,
          left: stripLeft,
          width: RAIL_COLUMNS,
          children: [Client({ key: 'rail', module: './rail.ts', props, width: RAIL_COLUMNS, height: railLayout(props).length })],
        }),
        ...(open === null ? [] : [drawerFrame(open)]),
        ...(popped.length === 0
          ? []
          : [
              Box({
                position: 'absolute',
                top: VIEWPORT_TOP,
                left: stripLeft - popoutColumns,
                width: popoutColumns,
                flexDirection: 'column',
                alignItems: 'flex-end',
                children: popped.map(t => Box({ key: popoutSlotKey(t.id), width: t.drawerColumns, flexDirection: 'column', children: [] })),
              }),
            ]),
      ],
    })

    function drawerFrame(tool: DrawerTool) {
      return Box({
        position: 'absolute',
        top: VIEWPORT_TOP,
        left: stripLeft - tool.drawerColumns,
        width: tool.drawerColumns,
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'claude',
        backgroundColor: DRAWER_BACKGROUND,
        paddingX: DRAWER_PADDING,
        children: [
          Box({
            flexDirection: 'row',
            justifyContent: 'space-between',
            children: [
              Text({ bold: true, children: [`${tool.icon} ${tool.short}`] }),
              Button({ key: 'drawer-close', label: '✕', onPress: () => save($, now => ({ ...now, selected: null })) }),
            ],
          }),
          Box({ key: drawerSlotKey(tool.id), flexDirection: 'column', children: [] }),
        ],
      })
    }
  })
}
