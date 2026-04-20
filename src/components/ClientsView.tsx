import { useState } from 'react'
import type { Client } from '../types'
import { createClientApi, updateClientApi } from '../lib/storage'

export const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#64748b', '#78716c', '#d946ef', '#2dd4bf', '#fb923c',
]

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="color-picker">
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          className={`color-swatch${value === color ? ' selected' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={color}
        />
      ))}
    </div>
  )
}

interface ClientsViewProps {
  clients: Client[]
  onRefresh: () => Promise<void>
  onClientCreated?: (client: Client) => void
}

export function ClientsView({ clients, onRefresh, onClientCreated }: ClientsViewProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const client = await createClientApi({ name: newName.trim(), color: newColor })
    await onRefresh()
    setNewName('')
    setNewColor(COLOR_PALETTE[0])
    onClientCreated?.(client)
  }

  function startEdit(client: Client) {
    setEditingId(client.id)
    setEditName(client.name)
    setEditColor(client.color)
  }

  async function saveEdit(client: Client) {
    await updateClientApi(client.id, { name: editName.trim() || client.name, color: editColor })
    await onRefresh()
    setEditingId(null)
  }

  async function toggleVisibility(client: Client) {
    await updateClientApi(client.id, { visibleInTabs: !client.visibleInTabs })
    await onRefresh()
  }

  return (
    <div className="clients-view">
      <section className="panel">
        <h3>Add client</h3>
        <form onSubmit={handleAdd} className="add-client-form">
          <label>
            <span>Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Client name"
            />
          </label>
          <div className="add-client-color">
            <span>Color</span>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <button type="submit" disabled={!newName.trim()}>
            Add client
          </button>
        </form>
      </section>

      {clients.length > 0 && (
        <section className="panel">
          <h3>Clients</h3>
          <ul className="client-list">
            {clients.map((client) => (
              <li key={client.id} className="client-row">
                {editingId === client.id ? (
                  <div className="client-edit-row">
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="client-name-input"
                    />
                    <div className="client-edit-actions">
                      <button onClick={() => saveEdit(client)}>Save</button>
                      <button onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="client-view-row">
                    <span className="client-color-dot" style={{ background: client.color }} />
                    <span className="client-name">{client.name}</span>
                    <label className="client-visibility">
                      <input
                        type="checkbox"
                        checked={client.visibleInTabs}
                        onChange={() => toggleVisibility(client)}
                      />
                      Show in tabs
                    </label>
                    <button onClick={() => startEdit(client)}>Edit</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {clients.length === 0 && (
        <p className="empty">No clients yet. Add one above to get started.</p>
      )}
    </div>
  )
}
