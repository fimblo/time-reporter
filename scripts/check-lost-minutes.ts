/**
 * Finds tasks where a legacy override (no setAt) may have silently dropped
 * timer-tracked minutes. For each (task, date) with a legacy override, compares
 * the raw interval total against the override value.
 *
 * If interval_minutes > override_minutes there may be lost time.
 * If override_minutes > interval_minutes the override added time (intentional).
 *
 * Usage: node --experimental-strip-types scripts/check-lost-minutes.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { getDb, closeDb } from '../server/db.ts'
import { splitIntervalByDay } from '../src/lib/timeUtils.ts'
import type { Interval } from '../src/types.ts'

const CSV_OUT = path.join(import.meta.dirname, '..', 'time-report-lost-minutes.csv')

const db = getDb()

// ── 1. Load all legacy overrides (no set_at) ─────────────────────────────

const legacyOverrides = db.prepare(`
  SELECT
    do.task_id,
    do.date,
    do.minutes_override,
    t.topic,
    c.name AS client
  FROM daily_overrides do
  JOIN tasks t ON t.id = do.task_id
  JOIN clients c ON c.id = t.client_id
  WHERE do.set_at IS NULL
  ORDER BY do.date, c.name, t.topic
`).all() as { task_id: string; date: string; minutes_override: number; topic: string; client: string }[]

if (legacyOverrides.length === 0) {
  console.log('No legacy overrides found — nothing to check.')
  closeDb()
  process.exit(0)
}

// ── 2. For each override, sum the raw interval minutes on that day ────────

function intervalMinutesForDate(taskId: string, date: string): number {
  const rows = db.prepare(
    'SELECT id, task_id, start, end FROM intervals WHERE task_id = ? ORDER BY start'
  ).all(taskId) as { id: string; task_id: string; start: string; end: string | null }[]

  const intervals: Interval[] = rows.map(r => ({
    id: r.id, taskId: r.task_id, start: r.start, end: r.end,
  }))

  let total = 0
  for (const interval of intervals) {
    const chunks = splitIntervalByDay(interval, new Date())
    for (const chunk of chunks) {
      if (chunk.date === date) total += chunk.minutes
    }
  }
  return total
}

// ── 3. Compare and report ─────────────────────────────────────────────────

function fmtDiff(min: number): string {
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const sign = min >= 0 ? '+' : '-'
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`
}

function escapeCsv(v: string): string {
  return (v.includes(',') || v.includes('"') || v.includes('\n'))
    ? `"${v.replace(/"/g, '""')}"` : v
}

type Row = {
  date: string; client: string; topic: string
  interval_minutes: number; override_minutes: number; diff: number
  flag: string
}

const results: Row[] = []

for (const ov of legacyOverrides) {
  const intervalMin = intervalMinutesForDate(ov.task_id, ov.date)
  const diff = ov.minutes_override - intervalMin   // positive = override added time
  const flag = intervalMin > ov.minutes_override
    ? 'POSSIBLE LOST TIME'
    : intervalMin < ov.minutes_override
      ? 'override added time'
      : 'exact match'
  results.push({
    date: ov.date,
    client: ov.client,
    topic: ov.topic,
    interval_minutes: intervalMin,
    override_minutes: ov.minutes_override,
    diff,
    flag,
  })
}

closeDb()

// ── 4. Print summary ──────────────────────────────────────────────────────

const lost    = results.filter(r => r.flag === 'POSSIBLE LOST TIME')
const added   = results.filter(r => r.flag === 'override added time')
const exact   = results.filter(r => r.flag === 'exact match')

console.log(`Legacy overrides checked: ${results.length}`)
console.log(`  Possible lost time:  ${lost.length}`)
console.log(`  Override added time: ${added.length}`)
console.log(`  Exact match:         ${exact.length}`)

if (lost.length > 0) {
  const totalLost = lost.reduce((s, r) => s + (r.interval_minutes - r.override_minutes), 0)
  const h = Math.floor(totalLost / 60), m = totalLost % 60
  console.log(`\nTotal potentially lost: ${totalLost} min (${h}h ${m}m)`)
  console.log('\nDetails:')
  for (const r of lost) {
    const dropped = r.interval_minutes - r.override_minutes
    console.log(`  ${r.date}  ${r.client} / ${r.topic}`)
    console.log(`    intervals=${r.interval_minutes}min  override=${r.override_minutes}min  dropped=${fmtDiff(-dropped)}`)
  }
}

// ── 5. Write CSV ──────────────────────────────────────────────────────────

const header = 'date,client,topic,interval_minutes,override_minutes,diff_minutes,diff_hm,flag'
const lines = [header, ...results.map(r => [
  r.date,
  escapeCsv(r.client),
  escapeCsv(r.topic),
  r.interval_minutes,
  r.override_minutes,
  r.diff,
  fmtDiff(r.diff),
  r.flag,
].join(','))]

fs.writeFileSync(CSV_OUT, '\uFEFF' + lines.join('\n'))
console.log(`\nFull report written to time-report-lost-minutes.csv`)
