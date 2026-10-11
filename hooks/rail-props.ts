import type { SidebarBadgeLevel } from '../types/index'

/** What the host hands the rail `Client`: plain data, redrawn on every change. */
export type RailProps = {
  tools: { id: string; icon: string; short: string; badge?: { count: number; level: SidebarBadgeLevel } }[]
  switches: { id: string; short: string; isOn: boolean }[]
  selected: string | null
  isOpen: boolean
}

/** What the rail posts on a left click: `handle` (draw in or out), `tool:<id>` or `switch:<id>`. */
export type RailMessage = { press: string }
