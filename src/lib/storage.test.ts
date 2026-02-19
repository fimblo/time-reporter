import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AppState, Task } from '../types'
import { loadState, saveState } from './storage'

const STORAGE_KEY = 'time-reporter-state-v1'

describe('storage', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    vi.stubGlobal('window', {
      localStorage: {
        getItem(key: string) {
          return store[key] ?? null
        },
        setItem(key: string, value: string) {
          store[key] = value
        },
        removeItem(key: string) {
          delete store[key]
        },
        clear: () => {
          store = {}
        },
        get length() {
          return Object.keys(store).length
        },
        key: () => null,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loadState returns default when empty', () => {
    const state = loadState()
    expect(state.tasks).toEqual([])
  })

  it('saveState and loadState round-trip', () => {
    const task: Task = {
      id: 't1',
      client: 'Acme',
      topic: 'Coaching',
      createdAt: '2026-02-19T00:00:00.000Z',
      updatedAt: '2026-02-19T00:00:00.000Z',
      intervals: [],
    }
    const state: AppState = { tasks: [task] }
    saveState(state)
    const loaded = loadState()
    expect(loaded.tasks.length).toBe(1)
    expect(loaded.tasks[0].client).toBe('Acme')
    expect(store[STORAGE_KEY]).toBeDefined()
  })

  it('loadState returns default on invalid JSON', () => {
    store[STORAGE_KEY] = 'not json'
    const state = loadState()
    expect(state.tasks).toEqual([])
  })
})
