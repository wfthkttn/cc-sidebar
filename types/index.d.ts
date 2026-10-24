/** How loudly a badge asks for attention. */
export type SidebarBadgeLevel = 'info' | 'attention' | 'urgent'

export type SidebarTool = {
  /** Unique across all tools; a press on its tab raises `sidebar.press` with `element: 'tool:<id>'`. */
  id: string
  /** One glyph drawn on the tool's tab. */
  icon: string
  /** 1-4 characters under the icon; a longer one is refused. */
  short: string
  /** The drawer's and pop-out area's width, frame included; an integer of at least 20, else refused. Without one the tool has neither. */
  drawerColumns?: number
  /**
   * Where the tab sits: lower first, 0 when absent, ties in the order the tools registered. Mods register from
   * `session.start` after `next(e)`, so a mod loaded later registers earlier; `order` is what places a tab.
   */
  order?: number
}

/** One column pair of a tool's gauge: two bars, each a percent left, filled from the bottom; red at 10 or below. */
export type SidebarGaugeColumn = {
  /** One character under the pair. */
  letter: string
  /** The left and right bar's colors, as Text's `color` takes them; the letter takes the left one. */
  colors: [string, string]
  /** The left and right bar; null leaves one empty. */
  values: [number | null, number | null]
  /** Drawn dim with `?` for the letter: the values are old or missing. */
  isDim: boolean
}

export type SidebarBadge = {
  id: string
  /** A non-negative integer; 0 clears the badge. */
  count: number
  level: SidebarBadgeLevel
}

export type SidebarSwitch = {
  /** Unique across all switches; a press raises `sidebar.press` with `element: 'switch:<id>'`. */
  id: string
  /** 1-4 characters, drawn as `● diff` (on) or `○ diff` (off); a longer one is refused. */
  short: string
  isOn: boolean
}

export type SidebarPress = {
  /** `tool:<id>` or `switch:<id>`. */
  element: string
}

/** The transcript rows the host draws its overlays from; a tool filling a slot hooks the same ones. */
export type SidebarRowComponent =
  | 'UserMessage'
  | 'AssistantMessage'
  | 'ToolUse'
  | 'ToolResult'
  | 'ToolGroup'
  | 'CommandOutput'
  | 'TurnDuration'
  | 'InfoNotice'

/** The key of the empty Box a tool's open drawer holds for the tool to fill. */
export type SidebarDrawerSlot = `sidebar-drawer:${string}`
/** The key of the empty Box a tool's shown pop-out area holds. */
export type SidebarPopoutSlot = `sidebar-popout:${string}`
/** The key of the empty Box a tool's shown modal holds. */
export type SidebarModalSlot = `sidebar-modal:${string}`

/**
 * `$.sidebar`. A tool hears presses on its tab or switch by hooking `sidebar.press`:
 * `on('sidebar.press', async ($, e, next) => { if (e.element === 'tool:ask') ...; return next(e) })`.
 *
 * A tool with `drawerColumns` fills its slots (SidebarDrawerSlot, SidebarPopoutSlot) in its own
 * `ui.render` hook on the SidebarRowComponent rows, from the tree `next(e)` returns; it lists
 * `sidebar` under `dependencies`. A slot takes the height of what fills it; `room` says how much there is.
 */
export type Sidebar = {
  register(tool: SidebarTool): Promise<void>
  badge(badge: SidebarBadge): Promise<void>
  /**
   * Draws the tool's tab as bars in a tab's frame, 3 rows of bars and 5 rows in all, each column's letter set in
   * the bottom border under its pair. At most 3 columns fit, and values run 0 to 100, else refused; null draws the
   * icon again.
   */
  gauge(input: { id: string; columns: SidebarGaugeColumn[] | null }): Promise<void>
  /** Adds the switch, or updates its label and state. */
  setSwitch(sw: SidebarSwitch): Promise<void>
  /** The selected tool's id, or null. */
  selected(input: {}): Promise<string | null>
  /** Selects a tool, opening its drawer, or clears the selection with null; raises no `sidebar.press`. */
  select(input: { id: string | null }): Promise<void>
  /** Raised by the rail on a click; calling it does nothing beyond the event. */
  press(press: SidebarPress): Promise<void>
  /**
   * Shows or hides the tool's pop-out area at the top, left of the rail, drawn while the tool's drawer is closed;
   * refused for a tool without `drawerColumns`.
   */
  popout(input: { id: string; isShown: boolean }): Promise<void>
  /**
   * Shows or hides the tool's modal: a framed box at the top of the transcript, centred left of the rail and as wide as
   * `room().modal.columns` lets it be, drawn over the transcript and any drawer. One at a time: showing one hides the
   * one shown before. Refused for an unregistered tool.
   */
  modal(input: { id: string; isShown: boolean }): Promise<void>
  /**
   * The rows a drawer's slot and a pop-out area can fill, the columns the drawer's frame takes from `drawerColumns`,
   * and the rows and columns inside a modal's frame; null outside fullscreen or before the transcript's size is known.
   */
  room(input: {}): Promise<{ drawer: number; popout: number; drawerFrameColumns: number; modal: { rows: number; columns: number } } | null>
  /**
   * `isHeld: true` keeps the overlays drawn on the row they are on now, as well as on the newest row: a `Client` in a
   * slot that the person gave the keyboard stays the same instance, so the keys stay with it. The newest row's copy
   * is drawn on top, over the held one; `mirrored` says which is which. A tool already holding keeps its row: to move
   * the hold to the row on top now, let go and hold again. `false` lets go. A hold also ends when its tool's drawer
   * closes and it has no pop-out shown; the held row scrolling off screen does not end it.
   */
  hold(input: { id: string; isHeld: boolean }): Promise<void>
  /**
   * True for the row whose overlays are a copy drawn over a held row's: a tool draws its slot there from its hooks'
   * state, as a picture of the held instance that has the keys.
   */
  mirrored(input: { component: SidebarRowComponent; requestId: string }): Promise<boolean>
}

/** What the rail shows; the host's own `$.state`. */
export type SidebarRail = {
  tools: SidebarTool[]
  badges: Record<string, SidebarBadge>
  /** Absent in a rail kept before gauges existed. */
  gauges?: Record<string, SidebarGaugeColumn[]>
  switches: SidebarSwitch[]
  selected: string | null
  /** The strip is drawn out (tabs shown) rather than in (only its draw-in button). */
  isOpen: boolean
  /** `/sidebar` hid it: nothing is drawn, pop-outs included, until it is shown again. */
  isHidden?: true
}

declare module 'claude-code' {
  interface EngineInterface {
    sidebar: Sidebar
  }
  interface PluginState {
    sidebar: {
      rail: SidebarRail
    }
  }
}
