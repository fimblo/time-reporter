import { useState } from 'react'
import type { DailySummaryRow } from '../types'
import { addDays, dateKeyFromDate, formatMinutesAsHoursMinutes, getMondayOfWeek } from '../lib/timeUtils'

interface ReportViewProps {
  rows: DailySummaryRow[]
  now: Date
}

function formatWeekLabel(mondayStr: string): string {
  const [y, m, d] = mondayStr.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}, ${y}`
}

function rowKey(row: DailySummaryRow): string {
  return `${row.taskId}||${row.date}`
}

export function ReportView({ rows, now }: ReportViewProps) {
  const [weekOffset, setWeekOffset] = useState(-1)
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map())
  const [copied, setCopied] = useState(false)

  const todayKey = dateKeyFromDate(now)
  const currentMonday = getMondayOfWeek(todayKey)
  const targetMonday = addDays(currentMonday, weekOffset * 7)
  const targetSunday = addDays(targetMonday, 6)
  const weekLabel = formatWeekLabel(targetMonday)

  const weekRows = rows
    .filter((r) => r.date >= targetMonday && r.date <= targetSunday)
    .sort((a, b) => a.date.localeCompare(b.date) || a.topic.localeCompare(b.topic))

  function effectiveGroup(row: DailySummaryRow): string {
    return groupNames.get(rowKey(row)) ?? row.topic
  }

  function setGroup(row: DailySummaryRow, value: string) {
    setGroupNames((prev) => {
      const next = new Map(prev)
      if (value === '') next.delete(rowKey(row))
      else next.set(rowKey(row), value)
      return next
    })
  }

  // Build summary preserving first-seen group order
  const groupOrder: string[] = []
  const groupTotals = new Map<string, number>()
  for (const row of weekRows) {
    const group = effectiveGroup(row)
    if (!groupTotals.has(group)) {
      groupOrder.push(group)
      groupTotals.set(group, 0)
    }
    groupTotals.set(group, groupTotals.get(group)! + row.minutes)
  }
  const grandTotal = weekRows.reduce((s, r) => s + r.minutes, 0)

  function copyReport() {
    const pad = Math.max(...groupOrder.map((g) => g.length), 5)
    const lines = [
      `Week of ${weekLabel}`,
      '',
      ...groupOrder.map((g) => `${g.padEnd(pad + 2)}${formatMinutesAsHoursMinutes(groupTotals.get(g)!)}`),
      '─'.repeat(pad + 10),
      `${'Total'.padEnd(pad + 2)}${formatMinutesAsHoursMinutes(grandTotal)}`,
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="report-view">
      <div className="report-week-nav">
        <button onClick={() => setWeekOffset((o) => o - 1)}>&#8592;</button>
        <span className="report-week-label">{weekLabel}</span>
        <button onClick={() => setWeekOffset((o) => o + 1)} disabled={weekOffset >= 0}>&#8594;</button>
      </div>

      {weekRows.length === 0 ? (
        <p className="empty">No entries for this week.</p>
      ) : (
        <div className="report-body">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Topic</th>
                <th>Time</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {weekRows.map((row) => (
                <tr key={rowKey(row)}>
                  <td>{row.date}</td>
                  <td>{row.topic}</td>
                  <td>{formatMinutesAsHoursMinutes(row.minutes)}</td>
                  <td>
                    <input
                      className="group-input"
                      type="text"
                      value={groupNames.get(rowKey(row)) ?? ''}
                      placeholder={row.topic}
                      onChange={(e) => setGroup(row, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="report-summary">
            <table className="report-summary-table">
              <tbody>
                {groupOrder.map((group) => (
                  <tr key={group}>
                    <td className="report-summary-name">{group}</td>
                    <td className="report-summary-time">
                      {formatMinutesAsHoursMinutes(groupTotals.get(group)!)}
                    </td>
                  </tr>
                ))}
                <tr className="report-summary-total">
                  <td>Total</td>
                  <td>{formatMinutesAsHoursMinutes(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
            <button className="btn-copy-report" onClick={copyReport} disabled={weekRows.length === 0}>
              {copied ? 'Copied!' : 'Copy report'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
