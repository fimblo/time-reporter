import type { AppState, Client } from '../types'

// Use VITE_API_URL when set explicitly (e.g. vite preview or a production deploy
// pointing at a different host). In normal `npm run dev` use, leave it unset:
// the Vite dev proxy forwards /api/* to http://localhost:3001 automatically.
const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export async function loadState(): Promise<AppState> {
  const res = await fetch(`${BASE}/api/state`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<AppState>
}

export async function loadClients(): Promise<Client[]> {
  const res = await fetch(`${BASE}/api/clients`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<Client[]>
}

export async function createClientApi(data: { name: string; color: string }): Promise<Client> {
  const res = await fetch(`${BASE}/api/clients`, {
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
  const res = await fetch(`${BASE}/api/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function saveState(state: AppState): Promise<void> {
  const res = await fetch(`${BASE}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
}
