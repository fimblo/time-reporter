import type { AppState } from '../types'

const STORAGE_KEY = 'time-reporter-state-v1'

const defaultState: AppState = {
  tasks: [],
}

export function loadState(): AppState {
  if (typeof window === 'undefined') {
    return defaultState
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.tasks) {
      return defaultState
    }
    return parsed
  } catch {
    return defaultState
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return
  try {
    const serialized = JSON.stringify(state)
    window.localStorage.setItem(STORAGE_KEY, serialized)
  } catch {
    // ignore persistence errors in v1
  }
}

