import type { DailySummaryRow } from '../types'
import {
  computeActiveDays,
  computeDailyAverageMinutes,
  computeTotalMinutes,
  formatMinutesAsHoursMinutes,
} from '../lib/timeUtils'

interface OverviewViewProps {
  rows: DailySummaryRow[]
}

export function OverviewView({ rows }: OverviewViewProps) {
  const totalMinutes = computeTotalMinutes(rows)
  const activeDays = computeActiveDays(rows)
  const avgMinutes = computeDailyAverageMinutes(rows)

  const days = Array.from(new Set(rows.map((r) => r.date))).sort()

  const maxMinutes =
    rows.reduce((max, r) => (r.minutes > max ? r.minutes : max), 0) || 60

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
      </section>

      <section className="panel">
        <h3>By day</h3>
        {days.length === 0 ? (
          <p className="empty">No data yet.</p>
        ) : (
          <div className="bar-chart">
            {days.map((day) => {
              const dayRows = rows.filter((r) => r.date === day)
              const totalForDay = dayRows.reduce((sum, r) => sum + r.minutes, 0)
              const height = `${(totalForDay / maxMinutes) * 100}%`
              return (
                <div key={day} className="bar-column">
                  <div className="bar" style={{ height }}>
                    <span className="bar-label">
                      {formatMinutesAsHoursMinutes(totalForDay)}
                    </span>
                  </div>
                  <div className="bar-day">{day}</div>
                </div>
              )
            })}
          </div>
        )}
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
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.date}-${row.taskId}`}>
                  <td>{row.date}</td>
                  <td>{row.client || 'No client'}</td>
                  <td>{row.topic || 'No topic'}</td>
                  <td>{formatMinutesAsHoursMinutes(row.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

