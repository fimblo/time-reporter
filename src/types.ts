export type UUID = string

export interface Interval {
  id: UUID
  taskId: UUID
  start: string // ISO timestamp
  end: string | null // null means currently running
}

export interface DailyOverride {
  date: string // YYYY-MM-DD in local time
  minutesOverride: number
}

export interface Task {
  id: UUID
  client: string
  topic: string
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  intervals: Interval[]
  overrides?: DailyOverride[]
  notes?: string
}

export interface DailySummaryRow {
  date: string // YYYY-MM-DD
  taskId: UUID
  client: string
  topic: string
  minutes: number
}

export interface AppState {
  tasks: Task[]
  lastActiveTaskId?: UUID
}

