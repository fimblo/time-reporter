/**
 * Compares time-report.csv against the current database state.
 * Writes a diff report to time-report-diff.csv next to the original.
 *
 * Usage: node --experimental-strip-types scripts/diff-csv.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadAppState, loadClients, closeDb } from '../server/db.ts'
import { buildDailySummary } from '../src/lib/timeUtils.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const CSV_IN  = path.join(ROOT, 'time-report.csv')
const CSV_OUT = path.join(ROOT, 'time-report-diff.csv')

// ── 1. Load canonical minutes from the database ──────────────────────────

const clients = loadClients()
const state   = loadAppState()
closeDb()

const summary = buildDailySummary(state.tasks, new Date())

// Build a lookup: "date||client||topic" → minutes
const dbMap = new Map<string, number>()
for (const row of summary) {
  dbMap.set(`${row.date}||${row.client}||${row.topic}`, row.minutes)
}

// ── 2. Parse the CSV ──────────────────────────────────────────────────────

function parseCsv(raw: string): { date: string; client: string; topic: string; minutes: number }[] {
  const rows = []
  const lines = raw.replace(/^\uFEFF/, '').split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines.slice(1)) {      // skip header
    const cols = splitCsvLine(line)
    if (cols.length < 4) continue
    rows.push({ date: cols[0], client: cols[1], topic: cols[2], minutes: Number(cols[3]) })
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

const csvRows = parseCsv(fs.readFileSync(CSV_IN, 'utf-8'))

// ── 3. Diff ───────────────────────────────────────────────────────────────

function fmtDiff(diffMin: number): string {
  const abs = Math.abs(diffMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const sign = diffMin >= 0 ? '+' : '-'
  if (h > 0) return `${sign}${h}h ${m}m`
  return `${sign}${m}m`
}

type DiffRow = {
  date: string
  client: string
  topic: string
  csv_minutes: number | null
  db_minutes: number | null
  diff_minutes: number
}

const diffs: DiffRow[] = []

// Rows in CSV but missing or different in DB
for (const row of csvRows) {
  const key = `${row.date}||${row.client}||${row.topic}`
  const dbMin = dbMap.get(key) ?? null
  if (dbMin === null) {
    diffs.push({ date: row.date, client: row.client, topic: row.topic,
                 csv_minutes: row.minutes, db_minutes: null, diff_minutes: -row.minutes })
  } else if (dbMin !== row.minutes) {
    diffs.push({ date: row.date, client: row.client, topic: row.topic,
                 csv_minutes: row.minutes, db_minutes: dbMin, diff_minutes: dbMin - row.minutes })
  }
}

// Rows in DB but missing from CSV (only for dates the CSV covers)
const csvDateRange = { min: '9999', max: '0000' }
for (const r of csvRows) {
  if (r.date < csvDateRange.min) csvDateRange.min = r.date
  if (r.date > csvDateRange.max) csvDateRange.max = r.date
}

const csvKeys = new Set(csvRows.map(r => `${r.date}||${r.client}||${r.topic}`))
for (const [key, dbMin] of dbMap) {
  const [date] = key.split('||')
  if (date < csvDateRange.min || date > csvDateRange.max) continue   // outside CSV range
  if (!csvKeys.has(key)) {
    const [, client, topic] = key.split('||')
    diffs.push({ date, client, topic, csv_minutes: null, db_minutes: dbMin, diff_minutes: dbMin })
  }
}

diffs.sort((a, b) => a.date.localeCompare(b.date) || a.client.localeCompare(b.client))

// ── 4. Report ─────────────────────────────────────────────────────────────

if (diffs.length === 0) {
  console.log('No differences found between time-report.csv and the database.')
  process.exit(0)
}

function escapeCsv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n'))
    return `"${v.replace(/"/g, '""')}"`
  return v
}

const header = 'date,client,topic,csv_minutes,db_minutes,diff_minutes,diff_hm'
const lines = [header]
for (const d of diffs) {
  lines.push([
    d.date,
    escapeCsv(d.client),
    escapeCsv(d.topic),
    d.csv_minutes ?? 'MISSING',
    d.db_minutes  ?? 'MISSING',
    d.diff_minutes,
    fmtDiff(d.diff_minutes),
  ].join(','))
}

fs.writeFileSync(CSV_OUT, '\uFEFF' + lines.join('\n'))
console.log(`${diffs.length} difference(s) written to ${CSV_OUT}`)
for (const d of diffs) {
  const csvStr = d.csv_minutes !== null ? `${d.csv_minutes}min` : 'MISSING'
  const dbStr  = d.db_minutes  !== null ? `${d.db_minutes}min`  : 'MISSING'
  console.log(`  ${d.date}  ${d.client} / ${d.topic}:  csv=${csvStr}  db=${dbStr}  diff=${fmtDiff(d.diff_minutes)}`)
}
