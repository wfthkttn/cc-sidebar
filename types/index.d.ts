/**
 * How loudly a badge asks for attention.
 */
export type SidebarBadgeLevel = 'info' | 'attention' | 'urgent'

export type SidebarTool = {
  /** Unique across all tools; a press on its tab raises `sidebar.press` with `element: 'tool:<id>'`. */
  id: string
  /** One glyph drawn on the tool's tab. */
  icon: string
  /** 1-4 characters under the icon; a longer one is refused. */
  short: string
  /**
   * The width of the tool's drawer, frame included, and of its pop-out area;
   * a tool without one has neither. While the tool is selected, one
   * transcript row's render tree holds an empty Box keyed
   * `sidebar-drawer:<id>`; while its pop-out is shown and its drawer closed,
   * one keyed `sidebar-popout:<id>`. The tool, listing `sidebar` under
   * `dependencies`, fills them in its own render hook on the transcript rows,
   * from the tree `next(e)` returns. Both take the height of what fills them;
   * `room` says how much there is.
   */
  drawerColumns?: number
}

export type SidebarBadge = {
  id: string
  /** 0 clears the badge. */
  count: number
  level: SidebarBadgeLevel
}

export type SidebarSwitch = {
  /** Unique across all switches; a press raises `sidebar.press` with `element: 'switch:<id>'`. */
  id: string
  /** 1-4 characters, drawn as `● diff`; a longer one is refused. */
  short: string
  isOn: boolean
}

export type SidebarPress = {
  /** `tool:<id>` or `switch:<id>`. */
  element: string
}

/**
 * `$.sidebar`. A tool hears presses on its tab or switch by hooking the
 * `sidebar.press` event, which the rail raises:
 * `on('sidebar.press', async ($, e, next) => { if (e.element === 'tool:ask') ...; return next(e) })`.
 */
export type Sidebar = {
  register(tool: SidebarTool): Promise<void>
  badge(badge: SidebarBadge): Promise<void>
  /** Adds the switch, or updates its label and state. */
  setSwitch(sw: SidebarSwitch): Promise<void>
  /** The selected tool's id, or null. */
  selected(input: {}): Promise<string | null>
  /** Selects a tool as a click on its tab would, or clears the selection with null. */
  select(input: { id: string | null }): Promise<void>
  /** Raised by the rail on a click; calling it does nothing beyond the event. */
  press(press: SidebarPress): Promise<void>
  /** Shows or hides the tool's pop-out area, next to the rail at the top; refused for a tool without `drawerColumns`. */
  popout(input: { id: string; isShown: boolean }): Promise<void>
  /** The rows a drawer's slot and a pop-out area can fill; null outside fullscreen or before the transcript's height is known. */
  room(input: {}): Promise<{ drawer: number; popout: number } | null>
}

/** What the rail shows; the host's own `$.state`. */
export type SidebarRail = {
  tools: SidebarTool[]
  badges: Record<string, SidebarBadge>
  switches: SidebarSwitch[]
  selected: string | null
  /** The strip is drawn out (tabs shown) rather than in (only its folder tab). */
  isOpen: boolean
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
