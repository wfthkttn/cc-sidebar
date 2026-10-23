import type { SidebarRowComponent } from '../types/index'

export const ROW_COMPONENTS = [
  'UserMessage',
  'AssistantMessage',
  'ToolUse',
  'ToolResult',
  'ToolGroup',
  'CommandOutput',
  'TurnDuration',
  'InfoNotice',
] as const satisfies readonly SidebarRowComponent[]

/** The transcript rows drawn so far, in the order they were first seen. */
export class Rows {
  private rows = new Map<string, { order: number; isOnScreen: boolean }>()
  private nextOrder = 0

  see(key: string, isOnScreen: boolean) {
    const order = this.rows.get(key)?.order ?? this.nextOrder++
    this.rows.set(key, { order, isOnScreen })
  }

  clear() {
    this.rows.clear()
  }

  isOnScreen(key: string): boolean {
    return this.rows.get(key)?.isOnScreen === true
  }

  /** The bottom row on screen: rows drawn after the overlays' row paint over them. */
  anchor(): string | null {
    let bottom: { key: string; order: number } | null = null
    for (const [key, row] of this.rows) {
      if (row.isOnScreen && (bottom === null || row.order > bottom.order)) bottom = { key, order: row.order }
    }
    return bottom === null ? null : bottom.key
  }
}

export function rowKey(component: string, requestId: string) {
  return component + ':' + requestId
}
