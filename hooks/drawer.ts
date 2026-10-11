/** Transcript rows that report which of their rows are on screen. */
export const ROW_COMPONENTS = [
  'UserMessage',
  'AssistantMessage',
  'ToolUse',
  'ToolResult',
  'ToolGroup',
  'CommandOutput',
  'TurnDuration',
  'InfoNotice',
] as const

export type OnScreen = { first: number; last: number; of: number }

type Row = { order: number; onScreen: OnScreen | null }

export class Rows {
  private rows = new Map<string, Row>()
  private nextOrder = 0

  /** Records a row as drawn; rows keep the order they were first seen in. */
  see(key: string, onScreen: OnScreen | null) {
    const order = this.rows.get(key)?.order ?? this.nextOrder++
    this.rows.set(key, { order, onScreen })
  }

  clear() {
    this.rows.clear()
  }

  /** The bottom row on screen: rows drawn after the overlays' row paint over them. */
  anchor(): string | null {
    let bottom: { key: string; order: number } | null = null
    for (const [key, row] of this.rows) {
      if (row.onScreen !== null && (bottom === null || row.order > bottom.order)) bottom = { key, order: row.order }
    }
    return bottom?.key ?? null
  }
}

export function rowKey(component: string, requestId: string) {
  return component + ':' + requestId
}

export function drawerSlotKey(toolId: string) {
  return 'sidebar-drawer:' + toolId
}

export function popoutSlotKey(toolId: string) {
  return 'sidebar-popout:' + toolId
}
