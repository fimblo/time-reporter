import type { AppState, Client, Invoice, ReportGroupsData } from '../types'

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

export async function createInvoiceApi(
  clientId: string,
  data: Omit<Invoice, 'id' | 'clientId'>,
): Promise<Invoice> {
  const res = await fetch(`${BASE}/api/clients/${clientId}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<Invoice>
}

export async function updateInvoiceApi(
  clientId: string,
  invoiceId: string,
  data: { notes: string },
): Promise<void> {
  const res = await fetch(`${BASE}/api/clients/${clientId}/invoices/${invoiceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function deleteInvoiceApi(clientId: string, invoiceId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/clients/${clientId}/invoices/${invoiceId}`, {
    method: 'DELETE',
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

export async function loadReportGroups(): Promise<ReportGroupsData> {
  const res = await fetch(`${BASE}/api/report-groups`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<ReportGroupsData>
}

export async function saveReportGroups(data: ReportGroupsData): Promise<void> {
  const res = await fetch(`${BASE}/api/report-groups`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
}
