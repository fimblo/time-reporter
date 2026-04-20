#!/usr/bin/env node
// Import localStorage JSON export into SQLite.
// Usage: node --experimental-strip-types scripts/import-localstorage.ts [path-to-json]
//   Default path: localstorage.json in the project root.

import { readFileSync } from 'node:fs'
import { getDb } from '../server/db.ts'
import type { AppState } from '../src/types.ts'

const PRESET_COLORS: Record<string, string> = {
  Vantage: '#6366f1',
  Bjarkagard: '#10b981',
}

const FALLBACK_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899',
  '#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9', '#22c55e',
  '#eab308', '#64748b', '#d946ef', '#fb923c', '#2dd4bf',
]

const jsonPath = process.argv[2] ?? 'localstorage.json'
console.log(`Reading ${jsonPath}…`)

const raw = readFileSync(jsonPath, 'utf-8')
const data = JSON.parse(raw) as AppState

const db = getDb()

// ── Create clients ────────────────────────────────────────────────────────────

const clientNames = [...new Set(data.tasks.map((t) => t.client))].sort()
const insertClient = db.prepare(
  'INSERT OR IGNORE INTO clients (id, name, color, visible_in_tabs) VALUES (?, ?, ?, 1)',
)
const clientIdMap = new Map<string, string>()

for (let i = 0; i < clientNames.length; i++) {
  const name = clientNames[i]
  const id = crypto.randomUUID()
  const color = PRESET_COLORS[name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]
  insertClient.run(id, name, color)
  clientIdMap.set(name, id)
  console.log(`  client: ${name}  id=${id}  color=${color}`)
}

// ── Insert tasks, intervals, overrides ───────────────────────────────────────

const insertTask = db.prepare(`
  INSERT OR IGNORE INTO tasks (id, client_id, topic, created_at, updated_at, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const insertInterval = db.prepare(`
  INSERT OR IGNORE INTO intervals (id, task_id, start, end)
  VALUES (?, ?, ?, ?)
`)
const insertOverride = db.prepare(`
  INSERT OR IGNORE INTO daily_overrides (task_id, date, minutes_override, set_at)
  VALUES (?, ?, ?, ?)
`)
const insertMeta = db.prepare(
  'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
)

let taskCount = 0
let intervalCount = 0
let overrideCount = 0

db.transaction(() => {
  for (const task of data.tasks) {
    const clientId = clientIdMap.get(task.client)
    if (!clientId) throw new Error(`No client id for: "${task.client}"`)

    insertTask.run(
      task.id,
      clientId,
      task.topic,
      task.createdAt,
      task.updatedAt,
      task.notes ?? null,
    )
    taskCount++

    for (const iv of task.intervals) {
      insertInterval.run(iv.id, iv.taskId, iv.start, iv.end)
      intervalCount++
    }

    if (task.overrides) {
      for (const ov of task.overrides) {
        insertOverride.run(task.id, ov.date, ov.minutesOverride, ov.setAt ?? null)
        overrideCount++
      }
    }
  }

  if (data.lastActiveTaskId) {
    insertMeta.run('last_active_task_id', data.lastActiveTaskId)
  }
})()

console.log(`\nDone.`)
console.log(`  ${clientNames.length} clients`)
console.log(`  ${taskCount} tasks`)
console.log(`  ${intervalCount} intervals`)
console.log(`  ${overrideCount} daily overrides`)
