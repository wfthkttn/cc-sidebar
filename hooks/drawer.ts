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

/** The row the drawer is drawn from, and the drawer's top relative to that row's top. */
export type Anchor = { key: string; top: number }

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

  /**
   * The bottom row on screen, with the offset that puts the drawer's top at
   * the viewport's top, `viewportRows` tall.
   */
  anchor(viewportRows: number): Anchor | null {
    const visible = [...this.rows.entries()]
      .filter((entry): entry is [string, { order: number; onScreen: OnScreen }] => entry[1].onScreen !== null)
      .sort((a, b) => a[1].order - b[1].order)
    const bottom = visible.at(-1)
    if (bottom === undefined) return null
    const [key, { onScreen }] = bottom
    const overflows =
      visible.length < this.rows.size || visible.some(([, row]) => row.onScreen.first > 0) || onScreen.last < onScreen.of - 1
    // A transcript taller than the screen ends at its bottom edge; rows above, stale ones too, don't count.
    if (overflows) return { key, top: onScreen.last - (viewportRows - 1) }
    const above = visible.slice(0, -1).reduce((sum, [, row]) => sum + row.onScreen.last - row.onScreen.first + 1, 0)
    return { key, top: onScreen.first - above }
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
