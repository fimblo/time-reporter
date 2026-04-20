import type { AppState, Client } from '../types'

const STORAGE_KEY = 'time-reporter-state-v1'
const defaultState: AppState = { tasks: [] }

export async function loadState(): Promise<AppState> {
  const API_URL = import.meta.env.VITE_API_URL as string | undefined
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/state`)
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
    return res.json() as Promise<AppState>
  }
  if (typeof window === 'undefined') return defaultState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as AppState
    return parsed.tasks ? parsed : defaultState
  } catch {
    return defaultState
  }
}

export async function loadClients(): Promise<Client[]> {
  const API_URL = import.meta.env.VITE_API_URL as string | undefined
  if (!API_URL) return []
  const res = await fetch(`${API_URL}/api/clients`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<Client[]>
}

export async function createClientApi(data: { name: string; color: string }): Promise<Client> {
  const API_URL = import.meta.env.VITE_API_URL as string
  const res = await fetch(`${API_URL}/api/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<Client>
}

export async function updateClientApi(
  id: string,
  data: Partial<{ name: string; color: string; visibleInTabs: boolean }>,
): Promise<void> {
  const API_URL = import.meta.env.VITE_API_URL as string
  const res = await fetch(`${API_URL}/api/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function saveState(state: AppState): Promise<void> {
  const API_URL = import.meta.env.VITE_API_URL as string | undefined
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
    return
  }
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore persistence errors
  }
}
