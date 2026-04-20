// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb, createClient, loadAppState, loadClients, saveAppState, updateClient } from './db.ts'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'time-reporter-test-'))
  process.env.TIME_REPORTER_DB = path.join(tmpDir, 'test.sqlite')
})

afterEach(() => {
  closeDb()
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.TIME_REPORTER_DB
})

describe('clients', () => {
  it('starts with no clients', () => {
    expect(loadClients()).toEqual([])
  })

  it('creates and returns a client', () => {
    const client = createClient({ name: 'Acme', color: '#6366f1' })
    expect(client.name).toBe('Acme')
    expect(client.color).toBe('#6366f1')
    expect(client.visibleInTabs).toBe(true)
    expect(typeof client.id).toBe('string')
    expect(client.id.length).toBeGreaterThan(0)
  })

  it('lists created clients ordered by name', () => {
    createClient({ name: 'Zebra Corp', color: '#6366f1' })
    createClient({ name: 'Acme', color: '#10b981' })
    const clients = loadClients()
    expect(clients).toHaveLength(2)
    expect(clients[0].name).toBe('Acme')
    expect(clients[1].name).toBe('Zebra Corp')
  })

  it('updates client name and color', () => {
    const client = createClient({ name: 'Acme', color: '#6366f1' })
    updateClient(client.id, { name: 'Renamed', color: '#ef4444' })
    const updated = loadClients().find((c) => c.id === client.id)
    expect(updated?.name).toBe('Renamed')
    expect(updated?.color).toBe('#ef4444')
  })

  it('updates visibility to false', () => {
    const client = createClient({ name: 'Acme', color: '#6366f1' })
    updateClient(client.id, { visibleInTabs: false })
    expect(loadClients().find((c) => c.id === client.id)?.visibleInTabs).toBe(false)
  })

  it('defaults visibleInTabs to true', () => {
    const client = createClient({ name: 'Acme', color: '#6366f1', visibleInTabs: undefined })
    expect(client.visibleInTabs).toBe(true)
  })

  it('rejects a duplicate client name', () => {
    createClient({ name: 'Acme', color: '#6366f1' })
    expect(() => createClient({ name: 'Acme', color: '#ef4444' })).toThrow()
  })

  it('stores Swedish characters in client names', () => {
    const client = createClient({ name: 'Åsa & Öberg AB', color: '#6366f1' })
    expect(loadClients().find((c) => c.id === client.id)?.name).toBe('Åsa & Öberg AB')
  })
})

describe('app state', () => {
  it('returns empty state when database is empty', () => {
    const state = loadAppState()
    expect(state.tasks).toEqual([])
    expect(state.lastActiveTaskId).toBeUndefined()
  })

  it('saves and reloads a basic task with intervals', () => {
    createClient({ name: 'Acme', color: '#6366f1' })
    saveAppState({
      tasks: [
        {
          id: 'task-1',
          client: 'Acme',
          topic: 'Meeting',
          createdAt: '2026-01-01T09:00:00.000Z',
          updatedAt: '2026-01-01T10:00:00.000Z',
          intervals: [
            { id: 'iv-1', taskId: 'task-1', start: '2026-01-01T09:00:00.000Z', end: '2026-01-01T10:00:00.000Z' },
          ],
        },
      ],
    })
    const loaded = loadAppState()
    expect(loaded.tasks).toHaveLength(1)
    expect(loaded.tasks[0].topic).toBe('Meeting')
    expect(loaded.tasks[0].client).toBe('Acme')
    expect(loaded.tasks[0].intervals).toHaveLength(1)
    expect(loaded.tasks[0].intervals[0].id).toBe('iv-1')
    expect(loaded.tasks[0].intervals[0].end).toBe('2026-01-01T10:00:00.000Z')
  })

  it('saves and reloads an open (running) interval', () => {
    createClient({ name: 'Acme', color: '#6366f1' })
    saveAppState({
      tasks: [
        {
          id: 'task-1',
          client: 'Acme',
          topic: 'Deep work',
          createdAt: '2026-01-01T09:00:00.000Z',
          updatedAt: '2026-01-01T09:00:00.000Z',
          intervals: [
            { id: 'iv-1', taskId: 'task-1', start: '2026-01-01T09:00:00.000Z', end: null },
          ],
        },
      ],
    })
    const loaded = loadAppState()
    expect(loaded.tasks[0].intervals[0].end).toBeNull()
  })

  it('saves and reloads daily overrides with setAt', () => {
    createClient({ name: 'Acme', color: '#6366f1' })
    saveAppState({
      tasks: [
        {
          id: 'task-1',
          client: 'Acme',
          topic: 'X',
          createdAt: '2026-01-01T09:00:00.000Z',
          updatedAt: '2026-01-01T09:00:00.000Z',
          intervals: [],
          overrides: [{ date: '2026-01-01', minutesOverride: 120, setAt: '2026-01-01T12:00:00.000Z' }],
        },
      ],
    })
    const loaded = loadAppState()
    expect(loaded.tasks[0].overrides).toHaveLength(1)
    expect(loaded.tasks[0].overrides![0].minutesOverride).toBe(120)
    expect(loaded.tasks[0].overrides![0].setAt).toBe('2026-01-01T12:00:00.000Z')
  })

  it('saves and reloads lastActiveTaskId', () => {
    createClient({ name: 'Acme', color: '#6366f1' })
    saveAppState({
      tasks: [
        {
          id: 'task-1',
          client: 'Acme',
          topic: 'X',
          createdAt: '2026-01-01T09:00:00.000Z',
          updatedAt: '2026-01-01T09:00:00.000Z',
          intervals: [],
        },
      ],
      lastActiveTaskId: 'task-1',
    })
    expect(loadAppState().lastActiveTaskId).toBe('task-1')
  })

  it('replaces state on every save (no duplicates)', () => {
    createClient({ name: 'Acme', color: '#6366f1' })
    const state = {
      tasks: [
        {
          id: 'task-1',
          client: 'Acme',
          topic: 'First',
          createdAt: '2026-01-01T09:00:00.000Z',
          updatedAt: '2026-01-01T09:00:00.000Z',
          intervals: [],
        },
      ],
    }
    saveAppState(state)
    saveAppState(state)
    expect(loadAppState().tasks).toHaveLength(1)
  })

  it('throws when saving a task with an unknown client', () => {
    expect(() =>
      saveAppState({
        tasks: [
          {
            id: 'task-1',
            client: 'NonExistent',
            topic: 'X',
            createdAt: '2026-01-01T09:00:00.000Z',
            updatedAt: '2026-01-01T09:00:00.000Z',
            intervals: [],
          },
        ],
      }),
    ).toThrow(/Unknown client/)
  })

  it('stores Swedish characters in topics', () => {
    createClient({ name: 'Åsa & Öberg AB', color: '#6366f1' })
    saveAppState({
      tasks: [
        {
          id: 'task-sv',
          client: 'Åsa & Öberg AB',
          topic: 'Möte om hästar och väder',
          createdAt: '2026-01-01T09:00:00.000Z',
          updatedAt: '2026-01-01T09:00:00.000Z',
          intervals: [],
        },
      ],
    })
    const loaded = loadAppState()
    expect(loaded.tasks[0].client).toBe('Åsa & Öberg AB')
    expect(loaded.tasks[0].topic).toBe('Möte om hästar och väder')
  })
})
