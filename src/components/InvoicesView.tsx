import { useState } from 'react'
import type { Client, DailySummaryRow, Invoice } from '../types'
import {
  addDays,
  computeTotalMinutes,
  dateKeyFromDate,
  formatMinutesAsHoursMinutes,
  isDateInvoiced,
} from '../lib/timeUtils'

interface InvoicesViewProps {
  rows: DailySummaryRow[]
  client: Client
  now: Date
  onCreateInvoice: (data: Omit<Invoice, 'id' | 'clientId'>) => Promise<void>
  onUpdateInvoice: (id: string, notes: string) => Promise<void>
  onDeleteInvoice: (id: string) => Promise<void>
}

interface CreateForm {
  sentDate: string
  fromDate: string
  throughDate: string
  notes: string
}

export function InvoicesView({ rows, client, now, onCreateInvoice, onUpdateInvoice, onDeleteInvoice }: InvoicesViewProps) {
  const todayKey = dateKeyFromDate(now)
  const invoices = client.invoices

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CreateForm>({
    sentDate: todayKey,
    fromDate: todayKey,
    throughDate: todayKey,
    notes: '',
  })
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const sortedInvoices = [...invoices].sort((a, b) => b.sentDate.localeCompare(a.sentDate))

  const uninvoicedMinutes = computeTotalMinutes(
    rows.filter((r) => !isDateInvoiced(r.date, invoices))
  )

  const formMinutes = rows
    .filter((r) => r.date >= form.fromDate && r.date <= form.throughDate)
    .reduce((sum, r) => sum + r.minutes, 0)

  function openCreate() {
    const lastByThrough = [...invoices].sort((a, b) => b.throughDate.localeCompare(a.throughDate))[0]
    const fromDate = lastByThrough
      ? addDays(lastByThrough.throughDate, 1)
      : ([...rows].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? todayKey)
    setForm({ sentDate: todayKey, fromDate, throughDate: todayKey, notes: '' })
    setCreating(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onCreateInvoice({
        sentDate: form.sentDate,
        fromDate: form.fromDate,
        throughDate: form.throughDate,
        minutes: formMinutes,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      })
      setCreating(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotes(invoiceId: string) {
    if (!editingNotes) return
    setSaving(true)
    try {
      await onUpdateInvoice(invoiceId, editingNotes.notes)
      setEditingNotes(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="invoices-view">
      <section className="panel stats">
        <div className="stat-card stat-card--accent">
          <div className="stat-label">Uninvoiced</div>
          <div className="stat-value">{formatMinutesAsHoursMinutes(uninvoicedMinutes)}</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Invoices</h3>
          {!creating && (
            <button className="btn-export" onClick={openCreate}>New invoice</button>
          )}
        </div>

        {creating && (
          <form className="invoice-create-form" onSubmit={handleCreate}>
            <div className="invoice-create-fields">
              <label>
                Sent
                <input
                  type="date"
                  value={form.sentDate}
                  onChange={(e) => setForm({ ...form, sentDate: e.target.value })}
                  required
                />
              </label>
              <label>
                From
                <input
                  type="date"
                  value={form.fromDate}
                  onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                  required
                />
              </label>
              <label>
                Through
                <input
                  type="date"
                  value={form.throughDate}
                  onChange={(e) => setForm({ ...form, throughDate: e.target.value })}
                  required
                />
              </label>
              <label>
                Hours
                <span className="invoice-hours-preview">{formatMinutesAsHoursMinutes(formMinutes)}</span>
              </label>
            </div>
            <label className="invoice-notes-label">
              Notes
              <textarea
                className="invoice-notes-input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional"
                rows={2}
              />
            </label>
            <div className="invoice-create-actions">
              <button type="button" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" disabled={saving}>Create invoice</button>
            </div>
          </form>
        )}

        {sortedInvoices.length === 0 && !creating && (
          <p className="empty">No invoices yet.</p>
        )}

        {sortedInvoices.length > 0 && (
          <ul className="invoice-list">
            {sortedInvoices.map((inv) => (
              <li key={inv.id} className="invoice-item">
                <div className="invoice-item-header">
                  <div className="invoice-item-info">
                    <span className="invoice-range">{inv.fromDate} – {inv.throughDate}</span>
                    <span className="invoice-hours">{formatMinutesAsHoursMinutes(inv.minutes)}</span>
                    <span className="invoice-sent">sent {inv.sentDate}</span>
                  </div>
                  <div className="invoice-item-actions">
                    {editingNotes?.id !== inv.id && (
                      <button
                        className="btn-row-action"
                        onClick={() => setEditingNotes({ id: inv.id, notes: inv.notes ?? '' })}
                      >
                        {inv.notes ? 'Edit notes' : 'Add notes'}
                      </button>
                    )}
                    <button
                      className="btn-row-action btn-row-delete"
                      onClick={() => onDeleteInvoice(inv.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {editingNotes?.id === inv.id ? (
                  <div className="invoice-notes-edit">
                    <textarea
                      className="invoice-notes-input"
                      value={editingNotes.notes}
                      onChange={(e) => setEditingNotes({ ...editingNotes, notes: e.target.value })}
                      rows={2}
                      autoFocus
                    />
                    <div className="invoice-notes-edit-actions">
                      <button type="button" onClick={() => setEditingNotes(null)}>Cancel</button>
                      <button type="button" disabled={saving} onClick={() => handleSaveNotes(inv.id)}>Save</button>
                    </div>
                  </div>
                ) : inv.notes ? (
                  <div className="invoice-notes">{inv.notes}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
