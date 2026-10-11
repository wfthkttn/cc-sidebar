import type { SidebarBadge, SidebarSwitch, SidebarTool } from '../types/index'

export type RailBadge = Pick<SidebarBadge, 'count' | 'level'>

/** What the host hands the rail `Client`: plain data, redrawn on every change. */
export type RailProps = {
  tools: (Pick<SidebarTool, 'id' | 'icon' | 'short'> & { badge?: RailBadge })[]
  switches: SidebarSwitch[]
  selected: string | null
  isOpen: boolean
}

/** What the rail posts on a left click: `toggle` (draw in or out), `tool:<id>` or `switch:<id>`. */
export type RailMessage = { press: string }
