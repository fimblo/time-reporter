import { Fragment, useEffect, useState } from 'react'
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

const GROUPS_KEY = 'report-groups'

function loadGroups(): Map<string, string> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (!raw) return new Map()
    return new Map(JSON.parse(raw) as [string, string][])
  } catch {
    return new Map()
  }
}

function saveGroups(groups: Map<string, string>): void {
  localStorage.setItem(GROUPS_KEY, JSON.stringify([...groups.entries()]))
}

export function ReportView({ rows, now }: ReportViewProps) {
  const [weekOffset, setWeekOffset] = useState(-1)
  // rowKey → groupId
  const [groups, setGroups] = useState<Map<string, string>>(loadGroups)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  useEffect(() => { saveGroups(groups) }, [groups])
  const [copied, setCopied] = useState(false)

  const todayKey = dateKeyFromDate(now)
  const currentMonday = getMondayOfWeek(todayKey)
  const targetMonday = addDays(currentMonday, weekOffset * 7)
  const targetSunday = addDays(targetMonday, 6)
  const weekLabel = formatWeekLabel(targetMonday)

  const weekRows = rows
    .filter((r) => r.date >= targetMonday && r.date <= targetSunday)
    .sort((a, b) => a.date.localeCompare(b.date) || a.topic.localeCompare(b.topic))

  // Group IDs in creation (Map insertion) order
  const groupIds = [...new Set(groups.values())]

  function getGroupRows(gid: string) {
    return weekRows.filter((r) => groups.get(rowKey(r)) === gid)
  }

  const ungroupedRows = weekRows.filter((r) => !groups.has(rowKey(r)))
  const grandTotal = weekRows.reduce((s, r) => s + r.minutes, 0)

  function handleDrop(targetRow: DailySummaryRow) {
    if (!draggingKey) return
    const targetKey = rowKey(targetRow)
    if (draggingKey === targetKey) { setDraggingKey(null); setDragOverKey(null); return }

    setGroups((prev) => {
      const next = new Map(prev)
      const sourceGroupId = prev.get(draggingKey)
      const targetGroupId = prev.get(targetKey)
      const joinGroupId = targetGroupId ?? `g${Date.now()}`

      if (!targetGroupId) next.set(targetKey, joinGroupId)
      next.set(draggingKey, joinGroupId)

      // Dissolve old group if it now has ≤1 member
      if (sourceGroupId && sourceGroupId !== joinGroupId) {
        const remaining = [...next.entries()].filter(([, g]) => g === sourceGroupId)
        if (remaining.length <= 1) remaining.forEach(([k]) => next.delete(k))
      }
      return next
    })

    setDraggingKey(null)
    setDragOverKey(null)
  }

  function handleDetach(row: DailySummaryRow) {
    const key = rowKey(row)
    setGroups((prev) => {
      const gid = prev.get(key)
      if (!gid) return prev
      const next = new Map(prev)
      next.delete(key)
      const remaining = [...next.entries()].filter(([, g]) => g === gid)
      if (remaining.length <= 1) remaining.forEach(([k]) => next.delete(k))
      return next
    })
  }

  function copyReport() {
    const lines: string[] = [`Week of ${weekLabel}`, '']
    groupIds.forEach((gid, i) => {
      const total = getGroupRows(gid).reduce((s, r) => s + r.minutes, 0)
      if (total > 0) lines.push(`Group ${i + 1}   ${formatMinutesAsHoursMinutes(total)}`)
    })
    lines.push('─'.repeat(20))
    lines.push(`Total      ${formatMinutesAsHoursMinutes(grandTotal)}`)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function renderRow(row: DailySummaryRow, inGroup: boolean) {
    const key = rowKey(row)
    return (
      <tr
        key={key}
        className={[
          'report-row',
          inGroup         ? 'report-row--grouped'   : '',
          draggingKey === key ? 'report-row--dragging'  : '',
          dragOverKey === key ? 'report-row--drag-over' : '',
        ].filter(Boolean).join(' ')}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggingKey(key) }}
        onDragEnd={() => { setDraggingKey(null); setDragOverKey(null) }}
        onDragOver={(e) => { e.preventDefault(); setDragOverKey(key) }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOverKey(null) }}
        onDrop={(e) => { e.preventDefault(); handleDrop(row) }}
      >
        <td className="report-drag-handle">⠿</td>
        <td>{row.date}</td>
        <td>{row.topic}</td>
        <td className="report-time">{formatMinutesAsHoursMinutes(row.minutes)}</td>
        <td className="report-actions">
          {inGroup && (
            <button className="btn-detach" onClick={() => handleDetach(row)} title="Remove from group">
              ✕
            </button>
          )}
        </td>
      </tr>
    )
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
        <>
          <table className="detail-table report-table">
            <thead>
              <tr>
                <th></th>
                <th>Date</th>
                <th>Topic</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groupIds.map((gid, i) => {
                const gRows = getGroupRows(gid)
                if (gRows.length === 0) return null
                const groupTotal = gRows.reduce((s, r) => s + r.minutes, 0)
                const collapsed = collapsedGroups.has(gid)
                const toggle = () => setCollapsedGroups((prev) => {
                  const next = new Set(prev)
                  collapsed ? next.delete(gid) : next.add(gid)
                  return next
                })
                return (
                  <Fragment key={gid}>
                    <tr className="report-group-header" onClick={toggle}>
                      <td className="report-group-toggle">{collapsed ? '▶' : '▼'}</td>
                      <td colSpan={2}>Group {i + 1}</td>
                      <td className="report-time">{formatMinutesAsHoursMinutes(groupTotal)}</td>
                      <td></td>
                    </tr>
                    {!collapsed && gRows.map((row) => renderRow(row, true))}
                  </Fragment>
                )
              })}
              {ungroupedRows.map((row) => renderRow(row, false))}
              <tr className="report-grand-total">
                <td></td>
                <td colSpan={2}>Total</td>
                <td className="report-time">{formatMinutesAsHoursMinutes(grandTotal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          {groupIds.length > 0 && (
            <div>
              <button className="btn-copy-report" onClick={copyReport}>
                {copied ? 'Copied!' : 'Copy report'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
