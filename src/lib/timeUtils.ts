import type { AppState, DailySummaryRow, Interval, Task, UUID } from '../types'

export function nowIso(): string {
  return new Date().toISOString()
}

export function formatMinutesAsHoursMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.abs(minutes)
  const hours = Math.floor(abs / 60)
  const mins = abs % 60
  const parts: string[] = []
  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  parts.push(`${mins}m`)
  return `${sign}${parts.join(' ')}`
}

export function formatSecondsAsHoursMinutesSeconds(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : ''
  const abs = Math.floor(Math.abs(totalSeconds))
  const hours = Math.floor(abs / 3600)
  const mins = Math.floor((abs % 3600) / 60)
  const secs = abs % 60
  const parts: string[] = []
  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  if (mins > 0) {
    parts.push(`${mins}m`)
  }
  parts.push(`${secs}s`)
  return `${sign}${parts.join(' ')}`
}

export function durationMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0
  }
  return Math.round((end - start) / (1000 * 60))
}

function dateKeyFromLocal(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface DailyChunk {
  date: string
  minutes: number
}

export function splitIntervalByDay(interval: Interval, now: Date = new Date()): DailyChunk[] {
  const start = new Date(interval.start)
  const end = interval.end ? new Date(interval.end) : now
  if (!(start instanceof Date) || !(end instanceof Date) || end <= start) {
    return []
  }

  const chunks: DailyChunk[] = []
  let cursor = new Date(start)

  // iterate day by day until we pass end
  while (cursor < end) {
    const dayEnd = new Date(cursor)
    dayEnd.setHours(23, 59, 59, 999)

    const segmentEnd = dayEnd < end ? dayEnd : end
    const minutes = durationMinutes(cursor.toISOString(), segmentEnd.toISOString())
    if (minutes > 0) {
      chunks.push({
        date: dateKeyFromLocal(cursor),
        minutes,
      })
    }

    // move to start of next day
    const nextDay = new Date(cursor)
    nextDay.setDate(cursor.getDate() + 1)
    nextDay.setHours(0, 0, 0, 0)
    cursor = nextDay
  }

  return chunks
}

export function buildDailySummary(tasks: Task[], now: Date = new Date()): DailySummaryRow[] {
  const byKey = new Map<string, DailySummaryRow>()

  for (const task of tasks) {
    const baseKey = `${task.client}||${task.topic}||${task.id}`

    for (const interval of task.intervals) {
      const chunks = splitIntervalByDay(interval, now)
      for (const chunk of chunks) {
        const key = `${chunk.date}||${baseKey}`
        const existing = byKey.get(key)
        if (existing) {
          existing.minutes += chunk.minutes
        } else {
          byKey.set(key, {
            date: chunk.date,
            taskId: task.id,
            client: task.client,
            topic: task.topic,
            minutes: chunk.minutes,
          })
        }
      }
    }

    if (task.overrides) {
      for (const override of task.overrides) {
        const key = `${override.date}||${baseKey}`
        const existing = byKey.get(key)
        if (existing) {
          existing.minutes = override.minutesOverride
        } else {
          byKey.set(key, {
            date: override.date,
            taskId: task.id,
            client: task.client,
            topic: task.topic,
            minutes: override.minutesOverride,
          })
        }
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function computeTotalMinutes(rows: DailySummaryRow[]): number {
  return rows.reduce((sum, row) => sum + row.minutes, 0)
}

export function computeActiveDays(rows: DailySummaryRow[]): number {
  const dates = new Set(rows.map((r) => r.date))
  return dates.size
}

export function computeDailyAverageMinutes(rows: DailySummaryRow[]): number {
  const total = computeTotalMinutes(rows)
  const active = computeActiveDays(rows)
  if (active === 0) return 0
  return Math.round(total / active)
}

export function computeSecondsToday(task: Task, todayKey: string, now: Date): number {
  if (task.overrides) {
    const override = task.overrides.find((o) => o.date === todayKey)
    if (override !== undefined) {
      return override.minutesOverride * 60
    }
  }
  let totalSeconds = 0
  const [y, m, d] = todayKey.split('-').map(Number)
  const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0)
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999)
  for (const interval of task.intervals) {
    const startMs = new Date(interval.start).getTime()
    const endMs = interval.end ? new Date(interval.end).getTime() : now.getTime()
    if (endMs <= startMs) continue
    const segStart = Math.max(startMs, startOfDay.getTime())
    const segEnd = Math.min(endMs, endOfDay.getTime())
    if (segEnd > segStart) {
      totalSeconds += Math.round((segEnd - segStart) / 1000)
    }
  }
  return totalSeconds
}

export function findActiveInterval(tasks: Task[]): { taskId: UUID; interval: Interval } | null {
  for (const task of tasks) {
    const active = task.intervals.find((i) => i.end === null)
    if (active) {
      return { taskId: task.id, interval: active }
    }
  }
  return null
}

export function cloneAppState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState
}

export function dateKeyFromDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getMondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Std dev of daily totals across active (non-zero) days only. */
export function computeStdDevMinutes(rows: DailySummaryRow[]): number {
  const byDate = new Map<string, number>()
  for (const row of rows) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.minutes)
  }
  const values = Array.from(byDate.values())
  if (values.length <= 1) return 0
  const avg = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length
  return Math.round(Math.sqrt(variance))
}

