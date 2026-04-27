/**
 * Seed a demo SQLite database with 3 fictional clients and ~4 weeks of data.
 * Usage: npm run seed:demo
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { AppState, Interval, Task } from '../src/types.ts'
import { createClient, saveAppState, closeDb } from '../server/db.ts'

const DEMO_DB = path.resolve(process.cwd(), 'data', 'demo.sqlite')

// Set env before any DB access so getDb() picks it up
process.env.TIME_REPORTER_DB = DEMO_DB

// Wipe any existing demo database
if (fs.existsSync(DEMO_DB)) {
  fs.rmSync(DEMO_DB)
  console.log('Removed existing demo.sqlite')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Returns YYYY-MM-DD for a date offset by `offsetDays` from `base`. */
function dateKey(base: Date, offsetDays: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Creates a closed interval for `date` starting at `startHour:startMin` lasting `durationMins`. */
function interval(taskId: string, date: string, startHour: number, startMin: number, durationMins: number): Interval {
  const start = new Date(`${date}T${pad(startHour)}:${pad(startMin)}:00`)
  const end = new Date(start.getTime() + durationMins * 60 * 1000)
  return {
    id: crypto.randomUUID(),
    taskId,
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

/** Creates an ISO timestamp for `date` at a given time (for createdAt/updatedAt). */
function ts(date: string, hour = 9, minute = 0): string {
  return new Date(`${date}T${pad(hour)}:${pad(minute)}:00`).toISOString()
}

// ── Reference point: Monday 4 weeks ago ─────────────────────────────────────
// Today = 2026-04-23 (Thursday). Monday of this week = 2026-04-20.
// We go back 3 full weeks to 2026-03-30.

const TODAY = new Date('2026-04-23T12:00:00')
// Find Monday of current week
const dayOfWeek = TODAY.getDay() === 0 ? 6 : TODAY.getDay() - 1 // 0=Mon
const thisMonday = new Date(TODAY)
thisMonday.setDate(TODAY.getDate() - dayOfWeek)

/** Offset from this Monday. Negative = past weeks. */
function d(weekOffset: number, dayOffset: number): string {
  return dateKey(thisMonday, weekOffset * 7 + dayOffset)
}
// weekOffset: -3 = 3 weeks ago, 0 = this week
// dayOffset:   0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri

// ── Clients ──────────────────────────────────────────────────────────────────

const acme = createClient({ name: 'Acme Corp', color: '#6366f1', visibleInTabs: true })
const leaf  = createClient({ name: 'Green Leaf', color: '#10b981', visibleInTabs: true })
const nova  = createClient({ name: 'Nova Tech', color: '#f59e0b', visibleInTabs: true })

console.log('Created clients:', acme.name, leaf.name, nova.name)

// ── Tasks ─────────────────────────────────────────────────────────────────────

// Acme Corp tasks
const t_api   = crypto.randomUUID()
const t_bugs  = crypto.randomUUID()
const t_pr    = crypto.randomUUID()

// Green Leaf tasks
const t_brand = crypto.randomUUID()
const t_social = crypto.randomUUID()
const t_deck  = crypto.randomUUID()

// Nova Tech tasks
const t_arch  = crypto.randomUUID()
const t_train = crypto.randomUUID()
const t_docs  = crypto.randomUUID()

// ── Build tasks with intervals ────────────────────────────────────────────────

const tasks: Task[] = [

  // ── Acme Corp ──────────────────────────────────────────────────────────────
  {
    id: t_api,
    client: acme.name,
    topic: 'API redesign',
    createdAt: ts(d(-3, 0)),
    updatedAt: ts(d(0, 2)),
    intervals: [
      // Week -3
      interval(t_api, d(-3, 0),  9,  0, 90),
      interval(t_api, d(-3, 0), 13, 30, 60),
      interval(t_api, d(-3, 1),  9,  0, 120),
      interval(t_api, d(-3, 3), 10,  0, 90),
      interval(t_api, d(-3, 4),  9,  0, 60),
      // Week -2
      interval(t_api, d(-2, 0),  9, 30, 100),
      interval(t_api, d(-2, 1), 14,  0,  75),
      interval(t_api, d(-2, 2),  9,  0, 110),
      interval(t_api, d(-2, 3), 10, 30,  90),
      // Week -1
      interval(t_api, d(-1, 0),  9,  0,  80),
      interval(t_api, d(-1, 2), 13,  0,  90),
      interval(t_api, d(-1, 3),  9,  0,  60),
      interval(t_api, d(-1, 4), 10,  0,  70),
      // This week
      interval(t_api, d(0, 0),   9,  0,  95),
      interval(t_api, d(0, 1),  10,  0,  85),
      interval(t_api, d(0, 2),   9, 30,  75),
    ],
  },

  {
    id: t_bugs,
    client: acme.name,
    topic: 'Bug triage',
    createdAt: ts(d(-3, 0)),
    updatedAt: ts(d(0, 2)),
    intervals: [
      interval(t_bugs, d(-3, 1), 11,  0, 45),
      interval(t_bugs, d(-3, 2),  9,  0, 30),
      interval(t_bugs, d(-3, 4), 14,  0, 60),
      interval(t_bugs, d(-2, 0), 11, 30, 45),
      interval(t_bugs, d(-2, 2), 15,  0, 50),
      interval(t_bugs, d(-2, 4), 10,  0, 35),
      interval(t_bugs, d(-1, 1), 11,  0, 40),
      interval(t_bugs, d(-1, 3), 14,  0, 55),
      interval(t_bugs, d(0, 0),  11,  0, 30),
      interval(t_bugs, d(0, 2),  14, 30, 45),
    ],
  },

  {
    id: t_pr,
    client: acme.name,
    topic: 'Code reviews',
    createdAt: ts(d(-3, 0)),
    updatedAt: ts(d(0, 1)),
    intervals: [
      interval(t_pr, d(-3, 2), 14,  0, 40),
      interval(t_pr, d(-3, 3), 15,  0, 30),
      interval(t_pr, d(-2, 1), 15, 30, 35),
      interval(t_pr, d(-2, 3), 14, 30, 40),
      interval(t_pr, d(-1, 0), 15,  0, 45),
      interval(t_pr, d(-1, 2), 15, 30, 30),
      interval(t_pr, d(-1, 4), 15,  0, 50),
      interval(t_pr, d(0, 1),  15, 30, 35),
    ],
  },

  // ── Green Leaf ─────────────────────────────────────────────────────────────
  {
    id: t_brand,
    client: leaf.name,
    topic: 'Brand refresh',
    createdAt: ts(d(-3, 0)),
    updatedAt: ts(d(0, 1)),
    intervals: [
      interval(t_brand, d(-3, 0), 10,  0, 120),
      interval(t_brand, d(-3, 2),  9,  0,  90),
      interval(t_brand, d(-3, 4), 10,  0, 100),
      interval(t_brand, d(-2, 0),  9,  0, 110),
      interval(t_brand, d(-2, 2), 10,  0,  80),
      interval(t_brand, d(-2, 4),  9,  0,  95),
      interval(t_brand, d(-1, 1), 10,  0,  70),
      interval(t_brand, d(-1, 3),  9, 30,  85),
      interval(t_brand, d(0, 0),  10,  0,  65),
      interval(t_brand, d(0, 1),   9,  0,  90),
    ],
  },

  {
    id: t_social,
    client: leaf.name,
    topic: 'Social media campaign',
    createdAt: ts(d(-2, 0)),
    updatedAt: ts(d(0, 2)),
    intervals: [
      interval(t_social, d(-2, 1), 11,  0,  60),
      interval(t_social, d(-2, 3), 11,  0,  75),
      interval(t_social, d(-1, 0), 11, 30,  50),
      interval(t_social, d(-1, 2), 11,  0,  65),
      interval(t_social, d(-1, 4), 11, 30,  55),
      interval(t_social, d(0, 2),  11,  0,  70),
    ],
  },

  {
    id: t_deck,
    client: leaf.name,
    topic: 'Client presentation',
    createdAt: ts(d(-1, 0)),
    updatedAt: ts(d(0, 2)),
    intervals: [
      interval(t_deck, d(-1, 1), 13,  0, 90),
      interval(t_deck, d(-1, 2), 13,  0, 80),
      interval(t_deck, d(-1, 4), 13, 30, 70),
      interval(t_deck, d(0, 0),  13,  0, 60),
      interval(t_deck, d(0, 2),  13, 30, 55),
    ],
  },

  // ── Nova Tech ──────────────────────────────────────────────────────────────
  {
    id: t_arch,
    client: nova.name,
    topic: 'Architecture review',
    createdAt: ts(d(-3, 0)),
    updatedAt: ts(d(0, 3)),
    intervals: [
      interval(t_arch, d(-3, 1), 10,  0, 110),
      interval(t_arch, d(-3, 3),  9,  0, 120),
      interval(t_arch, d(-2, 1),  9, 30, 100),
      interval(t_arch, d(-2, 3), 10,  0,  95),
      interval(t_arch, d(-1, 0), 10,  0,  80),
      interval(t_arch, d(-1, 2),  9,  0,  90),
      interval(t_arch, d(-1, 4),  9, 30,  85),
      interval(t_arch, d(0, 1),  10,  0,  75),
      interval(t_arch, d(0, 3),   9,  0,  60),
    ],
  },

  {
    id: t_train,
    client: nova.name,
    topic: 'Team training',
    createdAt: ts(d(-3, 0)),
    updatedAt: ts(d(0, 2)),
    intervals: [
      interval(t_train, d(-3, 2), 14,  0, 120),
      interval(t_train, d(-2, 2), 14,  0, 120),
      interval(t_train, d(-1, 2), 14,  0, 120),
      interval(t_train, d(0, 2),  14,  0,  90),
    ],
  },

  {
    id: t_docs,
    client: nova.name,
    topic: 'Documentation',
    createdAt: ts(d(-3, 0)),
    updatedAt: ts(d(0, 3)),
    intervals: [
      interval(t_docs, d(-3, 4), 13,  0,  60),
      interval(t_docs, d(-2, 0), 13, 30,  50),
      interval(t_docs, d(-2, 4), 13,  0,  55),
      interval(t_docs, d(-1, 1), 13, 30,  45),
      interval(t_docs, d(-1, 3), 13,  0,  60),
      interval(t_docs, d(0, 0),  13,  0,  40),
      interval(t_docs, d(0, 3),  13, 30,  50),
    ],
  },
]

// ── Persist ───────────────────────────────────────────────────────────────────

const state: AppState = { tasks }
saveAppState(state)
closeDb()

console.log(`Seeded ${tasks.length} tasks into ${DEMO_DB}`)
console.log('Run: npm run start:demo')
