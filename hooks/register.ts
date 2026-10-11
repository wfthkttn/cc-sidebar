import type { On } from 'claude-code'

import type { Sidebar, SidebarRail, SidebarTool } from '../types/index'
import { ROW_COMPONENTS, Rows, drawerSlotKey, popoutSlotKey, rowKey } from './drawer'
import type { RailMessage, RailProps } from './rail-props'

const PANE_ID = 'sidebar'
/** The narrowest dock Claude Code 2.1.296 seats (DOCK_MIN_COLUMNS); a smaller request comes out this wide. */
const RAIL_COLUMNS = 24
const SHORT_MAX = 4
/** The dock's border column and the blank column after it, left of the pane body. */
const DOCK_EDGE_COLUMNS = 2
/** Matches `COLORS.rail` in rail.ts. */
const RAIL_BACKGROUND = '#000000'
const DRAWER_BACKGROUND = '#11161f'
const DRAWER_MIN_COLUMNS = 20
/** A `UserMessage` row clips the transcript's last column, so an overlay hung from one ends a column short. */
const OVERLAY_RIGHT_MARGIN = 1

const EMPTY: SidebarRail = { tools: [], badges: {}, switches: [], selected: null }

/**
 * The rail kept twice: `$.state` survives a module reload but `/clear`,
 * `/resume` and `/branch` reset it; this variable survives those but not a
 * reload. Each restores the other, and tools register only once a session.
 */
let rail: SidebarRail = EMPTY
const transcript = new Rows()
let placed = ''
/** The dock body's rows as last drawn; null while the rail isn't docked. */
let dockRows: number | null = null
/** Tools whose pop-out area is shown; tools say so again after a reload. */
const popouts = new Set<string>()
/** The drawer frame's rows around its slot: top border, title row, bottom border. */
const DRAWER_FRAME_ROWS = 3

function checkShort(what: string, short: string) {
  if (short.length === 0 || short.length > SHORT_MAX) {
    throw new Error(`sidebar: ${what} short name "${short}" must be 1-${SHORT_MAX} characters`)
  }
}

/** The transcript rows a drawer or pop-out can cover; null while the rail isn't docked. */
function transcriptRows(): number | null {
  // The dock's `✕` row stands beside the transcript's top row.
  return dockRows === null ? null : dockRows + 1
}

/** The open drawer's tool and width, or null when no drawer is open. */
function openDrawer(): { tool: SidebarTool; columns: number } | null {
  const tool = rail.tools.find(t => t.id === rail.selected)
  if (tool?.drawerColumns === undefined || transcriptRows() === null) return null
  return { tool, columns: tool.drawerColumns }
}

/** Tools with a pop-out shown, their drawer closed. */
function poppedOut(): (SidebarTool & { drawerColumns: number })[] {
  if (transcriptRows() === null) return []
  return rail.tools.filter(
    (t): t is SidebarTool & { drawerColumns: number } =>
      popouts.has(t.id) && t.drawerColumns !== undefined && t.id !== rail.selected,
  )
}

export function register(on: On) {
  on('engine.create', async (_$, e, next) => {
    const beneath = await next(e)
    const change = async (edit: (now: SidebarRail) => SidebarRail) => {
      rail = edit(rail)
      await beneath.state.set({ plugin: 'sidebar', key: 'rail' }, rail)
    }
    const sidebar: Sidebar = {
      register: async tool => {
        checkShort(`tool "${tool.id}"`, tool.short)
        const { drawerColumns } = tool
        if (drawerColumns !== undefined && (!Number.isInteger(drawerColumns) || drawerColumns < DRAWER_MIN_COLUMNS)) {
          throw new Error(`sidebar: tool "${tool.id}" drawerColumns ${drawerColumns} must be an integer >= ${DRAWER_MIN_COLUMNS}`)
        }
        const entry = { id: tool.id, icon: tool.icon, short: tool.short, ...(drawerColumns === undefined ? {} : { drawerColumns }) }
        await change(now => ({
          ...now,
          tools: now.tools.some(t => t.id === tool.id)
            ? now.tools.map(t => (t.id === tool.id ? entry : t))
            : [...now.tools, entry],
        }))
      },
      badge: async badge => {
        if (!rail.tools.some(t => t.id === badge.id)) {
          throw new Error(`sidebar: badge for unregistered tool "${badge.id}"`)
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
        const entry = { ...sw }
        await change(now => ({
          ...now,
          switches: now.switches.some(s => s.id === sw.id)
            ? now.switches.map(s => (s.id === sw.id ? entry : s))
            : [...now.switches, entry],
        }))
      },
      selected: async () => rail.selected,
      select: async ({ id }) => {
        if (id !== null && !rail.tools.some(t => t.id === id)) {
          throw new Error(`sidebar: select of unregistered tool "${id}"`)
        }
        await change(now => ({ ...now, selected: id }))
        beneath.ui.invalidate('ui.render')
      },
      press: async () => {},
      popout: async ({ id, isShown }) => {
        const tool = rail.tools.find(t => t.id === id)
        if (tool?.drawerColumns === undefined) {
          throw new Error(`sidebar: pop-out for "${id}", which is no registered tool with a drawer`)
        }
        if (popouts.has(id) === isShown) return
        if (isShown) popouts.add(id)
        else popouts.delete(id)
        beneath.ui.invalidate('ui.render')
      },
      room: async () => {
        const rows = transcriptRows()
        return rows === null ? null : { drawer: rows - DRAWER_FRAME_ROWS, popout: rows }
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
      description: 'Show the sidebar again after closing it',
      immediate: true,
    })
    await $.ui.open({ id: PANE_ID, title: 'Sidebar', columns: RAIL_COLUMNS })
    return started
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await $.state.set({ plugin: 'sidebar', key: 'rail' }, rail)
    transcript.clear()
    return next(e)
  })

  on('command.run', { command: 'sidebar' }, async $ => {
    await $.ui.open({ id: PANE_ID, title: 'Sidebar', columns: RAIL_COLUMNS })
    return {}
  })

  on('ui.message', { element: 'rail' }, async ($, e, next) => {
    const { press } = e.data as RailMessage
    if (press.startsWith('tool:')) {
      const id = press.slice('tool:'.length)
      rail = { ...rail, selected: rail.selected === id ? null : id }
      await $.state.set({ plugin: 'sidebar', key: 'rail' }, rail)
      $.ui.invalidate('ui.render')
    }
    await $.sidebar.press({ element: press })
    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    // The rail is a `Client`; only the terminal's element table is sure to have one.
    if (e.requestId !== PANE_ID || e.surface !== 'terminal') return next(e)
    const { Box, Client, Text } = $.ui.resolve(e)
    const shown = (await $.state.get({ plugin: 'sidebar', key: 'rail' })).value ?? EMPTY
    const props: RailProps = {
      tools: shown.tools.map(tool => {
        const badge = shown.badges[tool.id]
        return badge ? { ...tool, badge: { count: badge.count, level: badge.level } } : { ...tool }
      }),
      switches: shown.switches,
      selected: shown.selected,
    }
    const rows = e.props.placement === 'dock' ? e.props.scroll.bodyRows : undefined
    if ((rows ?? null) !== dockRows) {
      dockRows = rows ?? null
      $.ui.invalidate('ui.render')
    }
    return Box({
      children: [
        Client({ key: 'rail', module: './rail.ts', props, width: e.props.bodyColumns, height: rows }),
        // Paints over the dock's own border and gap, so the rail's drawn edge is the only one.
        Box({
          position: 'absolute',
          top: 0,
          left: -DOCK_EDGE_COLUMNS,
          width: DOCK_EDGE_COLUMNS,
          height: rows,
          backgroundColor: RAIL_BACKGROUND,
          children: [Text({ children: [' '] })],
        }),
      ],
    })
  })

  on('ui.render', { component: [...ROW_COMPONENTS] }, async ($, e, next) => {
    const engine = await next(e)
    // A prompt's row while it is sent; a slash command's vanishes without reporting it left the screen.
    if (e.surface !== 'terminal' || e.props.onScreen === undefined || e.requestId === 'placeholder') return engine
    const key = rowKey(e.component, e.requestId)
    transcript.see(key, e.props.onScreen)
    const viewportRows = transcriptRows()
    const at = viewportRows === null ? null : transcript.anchor(viewportRows)
    const now = at === null ? '' : `${at.key}@${at.top}`
    if (now !== placed) {
      placed = now
      $.ui.invalidate('ui.render')
    }
    const open = openDrawer()
    const popped = poppedOut()
    if (at === null || at.key !== key || e.viewport === undefined || (open === null && popped.length === 0)) return engine

    const { Box, Button, Text } = $.ui.resolve(e)
    // From the left: a row's own box can be as narrow as its content (a running Bash call's is).
    const fromRight = (columns: number) => e.viewport!.columns - OVERLAY_RIGHT_MARGIN - columns
    const popoutColumns = Math.max(0, ...popped.map(t => t.drawerColumns))
    return Box({
      flexDirection: 'column',
      children: [
        engine,
        ...(open === null ? [] : [drawerFrame(open)]),
        ...(popped.length === 0
          ? []
          : [
              Box({
                position: 'absolute',
                top: at.top,
                left: fromRight(popoutColumns),
                width: popoutColumns,
                flexDirection: 'column',
                alignItems: 'flex-end',
                children: popped.map(t => Box({ key: popoutSlotKey(t.id), width: t.drawerColumns, flexDirection: 'column', children: [] })),
              }),
            ]),
      ],
    })

    function drawerFrame(open: { tool: SidebarTool; columns: number }) {
      return Box({
        position: 'absolute',
        top: at!.top,
        left: fromRight(open.columns),
        width: open.columns,
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'claude',
        backgroundColor: DRAWER_BACKGROUND,
        paddingX: 1,
        children: [
          Box({
            flexDirection: 'row',
            justifyContent: 'space-between',
            children: [
              Text({ bold: true, children: [`${open.tool.icon} ${open.tool.short}`] }),
              Button({
                key: 'drawer-close',
                label: '✕',
                onPress: async () => {
                  rail = { ...rail, selected: null }
                  await $.state.set({ plugin: 'sidebar', key: 'rail' }, rail)
                  $.ui.invalidate('ui.render')
                },
              }),
            ],
          }),
          Box({ key: drawerSlotKey(open.tool.id), flexDirection: 'column', children: [] }),
        ],
      })
    }
  })
}
