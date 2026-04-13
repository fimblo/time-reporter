import { Fragment } from 'react'
import type { DailySummaryRow } from '../types'
import {
  computeActiveDays,
  computeDailyAverageMinutes,
  computeTotalMinutes,
  formatMinutesAsHoursMinutes,
} from '../lib/timeUtils'

interface OverviewViewProps {
  rows: DailySummaryRow[]
  now: Date
}

function dateKeyFromDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatWeekLabel(mondayStr: string): string {
  const [y, m, d] = mondayStr.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}, ${y}`
}

export function OverviewView({ rows, now }: OverviewViewProps) {
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
  const rowsDesc = [...rows].sort((a, b) => b.date.localeCompare(a.date))
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
              </tr>
            </thead>
            <tbody>
              {weekKeys.map((monday) => (
                <Fragment key={monday}>
                  <tr className="week-header-row">
                    <td colSpan={4}>{formatWeekLabel(monday)}</td>
                  </tr>
                  {weekMap.get(monday)!.map((row) => (
                    <tr key={`${row.date}-${row.taskId}`}>
                      <td>{row.date}</td>
                      <td>{row.client || 'No client'}</td>
                      <td>{row.topic || 'No topic'}</td>
                      <td>{formatMinutesAsHoursMinutes(row.minutes)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
