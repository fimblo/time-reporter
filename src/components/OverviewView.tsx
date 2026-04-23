import { Fragment, useState } from 'react'
import type { DailySummaryRow, Task } from '../types'
import {
  addDays,
  computeActiveDays,
  computeDailyAverageMinutes,
  computeTotalMinutes,
  dateKeyFromDate,
  formatMinutesAsHoursMinutes,
  getMondayOfWeek,
} from '../lib/timeUtils'

interface OverviewViewProps {
  rows: DailySummaryRow[]
  tasks: Task[]
  now: Date
  onUpdateTask: (task: Task) => void
}

interface EditState {
  row: DailySummaryRow
  date: string
  topic: string
  hours: number
  mins: number
}

function formatWeekLabel(mondayStr: string): string {
  const [y, m, d] = mondayStr.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}, ${y}`
}

export function OverviewView({ rows: allRows, tasks, now, onUpdateTask }: OverviewViewProps) {
  const [editing, setEditing] = useState<EditState | null>(null)

  // Filter out 0-minute entries (deleted/zeroed rows)
  const rows = allRows.filter((r) => r.minutes > 0)

  const totalMinutes = computeTotalMinutes(rows)
  const activeDays = computeActiveDays(rows)
  const avgMinutes = computeDailyAverageMinutes(rows)

  // Current week stats (Mon–today)
  const todayKey = dateKeyFromDate(now)
  const currentWeekMonday = getMondayOfWeek(todayKey)
  const currentWeekMinutes = computeTotalMinutes(
    rows.filter((r) => r.date >= currentWeekMonday && r.date <= todayKey),
  )

  // Bar chart: last week (Mon–Sun) + this week (Mon–Sun), fixed 14 slots
  const lastWeekMonday = addDays(currentWeekMonday, -7)
  const lastWeekDays = Array.from({ length: 7 }, (_, i) => addDays(lastWeekMonday, i))
  const thisWeekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekMonday, i))

  const minutesForDay = (day: string) =>
    rows.filter((r) => r.date === day).reduce((s, r) => s + r.minutes, 0)

  const chartMax =
    [...lastWeekDays, ...thisWeekDays].reduce((max, day) => {
      const m = minutesForDay(day)
      return m > max ? m : max
    }, 0) || 60

  const hasLastWeekData = lastWeekDays.some((d) => minutesForDay(d) > 0)

  // Details grouped by week, newest week first
  const rowsDesc = [...rows].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date)
    if (dateCmp !== 0) return dateCmp
    return b.lastStart.localeCompare(a.lastStart)
  })
  const weekMap = new Map<string, DailySummaryRow[]>()
  for (const row of rowsDesc) {
    const monday = getMondayOfWeek(row.date)
    const bucket = weekMap.get(monday)
    if (bucket) bucket.push(row)
    else weekMap.set(monday, [row])
  }
  const weekKeys = Array.from(weekMap.keys()).sort((a, b) => b.localeCompare(a))

  function renderBars(days: string[], modifier: string) {
    return days.map((day) => {
      const total = minutesForDay(day)
      const height = `${(total / chartMax) * 100}%`
      return (
        <div key={day} className="bar-column">
          <div className="bar-track">
            <div className={`bar ${modifier}`} style={{ height }}>
              {total > 0 && (
                <span className="bar-label">{formatMinutesAsHoursMinutes(total)}</span>
              )}
            </div>
          </div>
          <div className="bar-day">{day.slice(5)}</div>
        </div>
      )
    })
  }

  function openEdit(row: DailySummaryRow) {
    setEditing({
      row,
      date: row.date,
      topic: row.topic,
      hours: Math.floor(row.minutes / 60),
      mins: row.minutes % 60,
    })
  }

  function handleDelete(row: DailySummaryRow) {
    const task = tasks.find((t) => t.id === row.taskId)
    if (!task) return
    const overrides = (task.overrides ?? []).filter((o) => o.date !== row.date)
    onUpdateTask({ ...task, overrides: [...overrides, { date: row.date, minutesOverride: 0 }] })
  }

  function handleSave() {
    if (!editing) return
    const { row, date, topic, hours, mins } = editing
    const task = tasks.find((t) => t.id === row.taskId)
    if (!task) return

    const newMinutes = hours * 60 + mins
    const dateChanged = date !== row.date
    const minutesChanged = newMinutes !== row.minutes
    const topicChanged = topic !== row.topic

    let updated: Task = { ...task }

    if (topicChanged) {
      updated = { ...updated, topic }
    }

    if (dateChanged) {
      // Zero out old date, set minutes on new date
      const overrides = (updated.overrides ?? []).filter(
        (o) => o.date !== row.date && o.date !== date,
      )
      updated = {
        ...updated,
        overrides: [
          ...overrides,
          { date: row.date, minutesOverride: 0 },
          { date, minutesOverride: newMinutes },
        ],
      }
    } else if (minutesChanged) {
      const overrides = (updated.overrides ?? []).filter((o) => o.date !== row.date)
      updated = {
        ...updated,
        overrides: [...overrides, { date: row.date, minutesOverride: newMinutes }],
      }
    }

    onUpdateTask(updated)
    setEditing(null)
  }

  return (
    <div className="overview-view">
      <section className="panel stats">
        <div className="stat-card">
          <div className="stat-label">Active days</div>
          <div className="stat-value">{activeDays}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total time</div>
          <div className="stat-value">{formatMinutesAsHoursMinutes(totalMinutes)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daily average</div>
          <div className="stat-value">{formatMinutesAsHoursMinutes(avgMinutes)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This week</div>
          <div className="stat-value">{formatMinutesAsHoursMinutes(currentWeekMinutes)}</div>
        </div>
      </section>

      <section className="panel">
        <h3>By day</h3>
        <div className="two-week-chart">
          {hasLastWeekData && (
            <div className="week-chart-group">
              <div className="week-chart-label">{formatWeekLabel(lastWeekMonday)}</div>
              <div className="bar-chart">{renderBars(lastWeekDays, 'bar--last-week')}</div>
            </div>
          )}
          <div className="week-chart-group">
            <div className="week-chart-label">{formatWeekLabel(currentWeekMonday)}</div>
            <div className="bar-chart">{renderBars(thisWeekDays, 'bar--this-week')}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Details</h3>
        {rows.length === 0 ? (
          <p className="empty">No entries.</p>
        ) : (
          <table className="detail-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Topic</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {weekKeys.map((monday) => {
                const weekRows = weekMap.get(monday)!
                const weekTotal = weekRows.reduce((s, r) => s + r.minutes, 0)
                return (
                <Fragment key={monday}>
                  <tr className="week-header-row">
                    <td colSpan={4}>{formatWeekLabel(monday)}</td>
                    <td>{weekTotal} min ({formatMinutesAsHoursMinutes(weekTotal)})</td>
                  </tr>
                  {weekRows.map((row) => (
                    <tr key={`${row.date}-${row.taskId}`} className="detail-row">
                      <td>{row.date}</td>
                      <td>{row.client || 'No client'}</td>
                      <td>{row.topic || 'No topic'}</td>
                      <td>{formatMinutesAsHoursMinutes(row.minutes)}</td>
                      <td className="row-actions">
                        <button className="btn-row-action" onClick={() => openEdit(row)}>Edit</button>
                        <button className="btn-row-action btn-row-delete" onClick={() => handleDelete(row)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit entry</h3>
            <div className="modal-body">
              <label>
                Date
                <input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </label>
              <label>
                Topic
                <input
                  type="text"
                  value={editing.topic}
                  onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
                />
              </label>
              <label>
                Time
                <div className="time-inputs">
                  <input
                    type="number"
                    min={0}
                    value={editing.hours}
                    onChange={(e) => setEditing({ ...editing, hours: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                  <span>h</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={editing.mins}
                    onChange={(e) => setEditing({ ...editing, mins: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                  />
                  <span>m</span>
                </div>
              </label>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditing(null)}>Cancel</button>
              <button onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
