import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import type { AppState, Client, DailyOverride, Interval, Invoice, ReportGroupsData, Task } from '../src/types.ts'

const DEFAULT_RELATIVE_DB = path.join('data', 'time-reporter.sqlite')

function getDbPath(): string {
  const env = process.env.TIME_REPORTER_DB
  if (env && path.isAbsolute(env)) return env
  if (env) return path.resolve(process.cwd(), env)
  return path.resolve(process.cwd(), DEFAULT_RELATIVE_DB)
}

let dbInstance: Database.Database | null = null

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance
  const dbPath = getDbPath()
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  dbInstance = db
  return db
}

function migrate(db: Database.Database): void {
  try { db.exec('ALTER TABLE daily_overrides ADD COLUMN set_at TEXT') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE clients ADD COLUMN invoiced_through TEXT') } catch { /* already exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY NOT NULL,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      sent_date TEXT NOT NULL,
      from_date TEXT NOT NULL,
      through_date TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      notes TEXT
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      visible_in_tabs INTEGER NOT NULL DEFAULT 1,
      invoiced_through TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      client_id TEXT NOT NULL REFERENCES clients(id),
      topic TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS intervals (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_overrides (
      task_id TEXT NOT NULL,
      date TEXT NOT NULL,
      minutes_override INTEGER NOT NULL,
      set_at TEXT,
      PRIMARY KEY (task_id, date),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_groups (
      group_id TEXT NOT NULL,
      task_id  TEXT NOT NULL,
      date     TEXT NOT NULL,
      PRIMARY KEY (task_id, date)
    );

    CREATE TABLE IF NOT EXISTS report_group_names (
      group_id TEXT PRIMARY KEY NOT NULL,
      name     TEXT NOT NULL
    );
  `)
}

// ── Client rows ─────────────────────────────────────────────────────────────

interface ClientRow {
  id: string
  name: string
  color: string
  visible_in_tabs: number
}

interface InvoiceRow {
  id: string
  client_id: string
  sent_date: string
  from_date: string
  through_date: string
  minutes: number
  notes: string | null
}

function rowToClient(row: ClientRow): Omit<Client, 'invoices'> {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    visibleInTabs: row.visible_in_tabs === 1,
  }
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    clientId: row.client_id,
    sentDate: row.sent_date,
    fromDate: row.from_date,
    throughDate: row.through_date,
    minutes: row.minutes,
    ...(row.notes ? { notes: row.notes } : {}),
  }
}

export function loadClients(): Client[] {
  const db = getDb()
  const clientRows = db.prepare('SELECT * FROM clients ORDER BY name').all() as ClientRow[]
  const allInvoiceRows = db.prepare('SELECT * FROM invoices ORDER BY sent_date DESC').all() as InvoiceRow[]
  return clientRows.map((row) => ({
    ...rowToClient(row),
    invoices: allInvoiceRows.filter((ir) => ir.client_id === row.id).map(rowToInvoice),
  }))
}

export function createClient(body: unknown): Client {
  if (body === null || typeof body !== 'object') throw new Error('Invalid body')
  const o = body as Record<string, unknown>
  if (typeof o.name !== 'string' || !o.name.trim()) throw new Error('name required')
  if (typeof o.color !== 'string') throw new Error('color required')
  const id = crypto.randomUUID()
  const visibleInTabs = o.visibleInTabs !== false ? 1 : 0
  const db = getDb()
  db.prepare(
    'INSERT INTO clients (id, name, color, visible_in_tabs) VALUES (?, ?, ?, ?)',
  ).run(id, o.name.trim(), o.color, visibleInTabs)
  return {
    ...rowToClient(db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as ClientRow),
    invoices: [],
  }
}

export function updateClient(id: string, body: unknown): void {
  if (body === null || typeof body !== 'object') throw new Error('Invalid body')
  const o = body as Record<string, unknown>
  const db = getDb()
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as ClientRow | undefined
  if (!existing) throw new Error('Client not found')
  const name = typeof o.name === 'string' ? o.name.trim() : existing.name
  const color = typeof o.color === 'string' ? o.color : existing.color
  const visibleInTabs = o.visibleInTabs === undefined ? existing.visible_in_tabs : (o.visibleInTabs ? 1 : 0)
  db.prepare(
    'UPDATE clients SET name = ?, color = ?, visible_in_tabs = ? WHERE id = ?',
  ).run(name, color, visibleInTabs, id)
}

// ── Invoice rows ─────────────────────────────────────────────────────────────

export function createInvoice(clientId: string, body: unknown): Invoice {
  if (body === null || typeof body !== 'object') throw new Error('Invalid body')
  const o = body as Record<string, unknown>
  if (typeof o.sentDate !== 'string') throw new Error('sentDate required')
  if (typeof o.fromDate !== 'string') throw new Error('fromDate required')
  if (typeof o.throughDate !== 'string') throw new Error('throughDate required')
  if (typeof o.minutes !== 'number') throw new Error('minutes required')
  const db = getDb()
  const clientExists = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId)
  if (!clientExists) throw new Error('Client not found')
  const id = crypto.randomUUID()
  const notes = typeof o.notes === 'string' && o.notes.trim() ? o.notes.trim() : null
  db.prepare(
    'INSERT INTO invoices (id, client_id, sent_date, from_date, through_date, minutes, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, clientId, o.sentDate, o.fromDate, o.throughDate, o.minutes, notes)
  return rowToInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow)
}

export function updateInvoice(clientId: string, invoiceId: string, body: unknown): void {
  if (body === null || typeof body !== 'object') throw new Error('Invalid body')
  const o = body as Record<string, unknown>
  const db = getDb()
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ? AND client_id = ?').get(invoiceId, clientId) as InvoiceRow | undefined
  if (!existing) throw new Error('Invoice not found')
  const notes = 'notes' in o
    ? (typeof o.notes === 'string' && o.notes.trim() ? o.notes.trim() : null)
    : existing.notes
  db.prepare('UPDATE invoices SET notes = ? WHERE id = ?').run(notes, invoiceId)
}

export function deleteInvoice(clientId: string, invoiceId: string): void {
  const db = getDb()
  const result = db.prepare('DELETE FROM invoices WHERE id = ? AND client_id = ?').run(invoiceId, clientId)
  if (result.changes === 0) throw new Error('Invoice not found')
}

// ── App state ────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string
  client_name: string
  topic: string
  created_at: string
  updated_at: string
  notes: string | null
}

interface IntervalRow {
  id: string
  task_id: string
  start: string
  end: string | null
}

interface OverrideRow {
  task_id: string
  date: string
  minutes_override: number
  set_at: string | null
}

export function loadAppState(): AppState {
  const db = getDb()
  const taskRows = db.prepare(`
    SELECT t.id, t.topic, t.created_at, t.updated_at, t.notes, c.name AS client_name
    FROM tasks t
    JOIN clients c ON t.client_id = c.id
    ORDER BY t.created_at
  `).all() as TaskRow[]

  const tasks: Task[] = taskRows.map((row) => {
    const intervalRows = db
      .prepare('SELECT * FROM intervals WHERE task_id = ? ORDER BY start')
      .all(row.id) as IntervalRow[]
    const intervals: Interval[] = intervalRows.map((ir) => ({
      id: ir.id,
      taskId: ir.task_id,
      start: ir.start,
      end: ir.end,
    }))
    const overrideRows = db
      .prepare('SELECT * FROM daily_overrides WHERE task_id = ? ORDER BY date')
      .all(row.id) as OverrideRow[]
    const overrides: DailyOverride[] | undefined =
      overrideRows.length > 0
        ? overrideRows.map((o) => ({
            date: o.date,
            minutesOverride: o.minutes_override,
            ...(o.set_at ? { setAt: o.set_at } : {}),
          }))
        : undefined
    const task: Task = {
      id: row.id,
      client: row.client_name,
      topic: row.topic,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      intervals,
      overrides,
    }
    if (row.notes) task.notes = row.notes
    return task
  })

  const lastRow = db.prepare("SELECT value FROM meta WHERE key = 'last_active_task_id'").get() as
    | { value: string }
    | undefined

  return { tasks, lastActiveTaskId: lastRow?.value }
}

function assertAppState(body: unknown): asserts body is AppState {
  if (body === null || typeof body !== 'object') throw new Error('Invalid body')
  const o = body as Record<string, unknown>
  if (!Array.isArray(o.tasks)) throw new Error('tasks must be an array')
  for (const t of o.tasks) {
    if (t === null || typeof t !== 'object') throw new Error('Invalid task')
    const task = t as Record<string, unknown>
    if (typeof task.id !== 'string') throw new Error('task.id required')
    if (typeof task.client !== 'string') throw new Error('task.client required')
    if (typeof task.topic !== 'string') throw new Error('task.topic required')
    if (typeof task.createdAt !== 'string') throw new Error('task.createdAt required')
    if (typeof task.updatedAt !== 'string') throw new Error('task.updatedAt required')
    if (!Array.isArray(task.intervals)) throw new Error('task.intervals required')
  }
}

export function saveAppState(state: unknown): void {
  assertAppState(state)
  const db = getDb()

  const getClientId = db.prepare('SELECT id FROM clients WHERE name = ?')
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, client_id, topic, created_at, updated_at, notes)
    VALUES (@id, @client_id, @topic, @created_at, @updated_at, @notes)
  `)
  const insertInterval = db.prepare(`
    INSERT INTO intervals (id, task_id, start, end)
    VALUES (@id, @task_id, @start, @end)
  `)
  const insertOverride = db.prepare(`
    INSERT INTO daily_overrides (task_id, date, minutes_override, set_at)
    VALUES (@task_id, @date, @minutes_override, @set_at)
  `)
  const insertMeta = db.prepare(`
    INSERT INTO meta (key, value) VALUES (@key, @value)
  `)

  const run = db.transaction(() => {
    db.prepare('DELETE FROM tasks').run()
    db.prepare("DELETE FROM meta WHERE key = 'last_active_task_id'").run()

    for (const task of state.tasks) {
      const clientRow = getClientId.get(task.client) as { id: string } | undefined
      if (!clientRow) throw new Error(`Unknown client: "${task.client}". Create it via POST /api/clients first.`)

      insertTask.run({
        id: task.id,
        client_id: clientRow.id,
        topic: task.topic,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
        notes: task.notes ?? null,
      })
      for (const interval of task.intervals) {
        insertInterval.run({
          id: interval.id,
          task_id: interval.taskId,
          start: interval.start,
          end: interval.end,
        })
      }
      if (task.overrides) {
        for (const ov of task.overrides) {
          insertOverride.run({
            task_id: task.id,
            date: ov.date,
            minutes_override: ov.minutesOverride,
            set_at: ov.setAt ?? null,
          })
        }
      }
    }
    if (state.lastActiveTaskId) {
      insertMeta.run({ key: 'last_active_task_id', value: state.lastActiveTaskId })
    }
  })
  run()
}

// ── Report groups ─────────────────────────────────────────────────────────────

export function loadReportGroups(): ReportGroupsData {
  const db = getDb()
  const memberRows = db.prepare('SELECT group_id, task_id, date FROM report_groups').all() as {
    group_id: string; task_id: string; date: string
  }[]
  const nameRows = db.prepare('SELECT group_id, name FROM report_group_names').all() as {
    group_id: string; name: string
  }[]
  return {
    memberships: memberRows.map((r) => ({ groupId: r.group_id, taskId: r.task_id, date: r.date })),
    names: nameRows.map((r) => ({ groupId: r.group_id, name: r.name })),
  }
}

export function saveReportGroups(data: unknown): void {
  if (data === null || typeof data !== 'object') throw new Error('Invalid body')
  const o = data as Record<string, unknown>
  if (!Array.isArray(o.memberships)) throw new Error('memberships must be an array')
  if (!Array.isArray(o.names)) throw new Error('names must be an array')
  const typed = data as ReportGroupsData

  const db = getDb()
  const insertMember = db.prepare('INSERT INTO report_groups (group_id, task_id, date) VALUES (?, ?, ?)')
  const insertName = db.prepare('INSERT INTO report_group_names (group_id, name) VALUES (?, ?)')
  db.transaction(() => {
    db.prepare('DELETE FROM report_groups').run()
    db.prepare('DELETE FROM report_group_names').run()
    for (const m of typed.memberships) insertMember.run(m.groupId, m.taskId, m.date)
    for (const n of typed.names) insertName.run(n.groupId, n.name)
  })()
}
