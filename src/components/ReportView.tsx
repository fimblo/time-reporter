import { Fragment, useEffect, useMemo, useState } from 'react'
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

/** Subsequence match: every char in query appears in order (not necessarily adjacent) in text. */
function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

const GROUPS_KEY      = 'report-groups'
const GROUP_NAMES_KEY = 'report-group-names'

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

function loadGroupNames(): Map<string, string> {
  try {
    const raw = localStorage.getItem(GROUP_NAMES_KEY)
    if (!raw) return new Map()
    return new Map(JSON.parse(raw) as [string, string][])
  } catch {
    return new Map()
  }
}

function saveGroupNames(names: Map<string, string>): void {
  localStorage.setItem(GROUP_NAMES_KEY, JSON.stringify([...names.entries()]))
}

export function ReportView({ rows, now }: ReportViewProps) {
  const [weekOffset, setWeekOffset] = useState(-1)
  // rowKey → groupId
  const [groups, setGroups] = useState<Map<string, string>>(loadGroups)
  const [groupNames, setGroupNames] = useState<Map<string, string>>(loadGroupNames)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [namingGroupId, setNamingGroupId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { saveGroups(groups) }, [groups])
  useEffect(() => { saveGroupNames(groupNames) }, [groupNames])

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

  // All unique topics for this client, sorted by frequency across all time
  const allTopics = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      counts.set(row.topic, (counts.get(row.topic) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic)
  }, [rows])

  const suggestions = nameInput.trim()
    ? allTopics.filter((t) => fuzzyMatch(nameInput, t)).slice(0, 10)
    : allTopics.slice(0, 10)

  function openNaming(gid: string) {
    setNamingGroupId(gid)
    setNameInput(groupNames.get(gid) ?? '')
  }

  function applyName(name: string) {
    if (!namingGroupId) return
    setGroupNames((prev) => {
      const next = new Map(prev)
      if (name.trim()) next.set(namingGroupId, name.trim())
      else next.delete(namingGroupId)
      return next
    })
    setNamingGroupId(null)
  }

  function dissolveGroupName(gid: string) {
    setGroupNames((prev) => {
      if (!prev.has(gid)) return prev
      const next = new Map(prev)
      next.delete(gid)
      return next
    })
  }

  function handleDrop(targetRow: DailySummaryRow) {
    if (!draggingKey) return
    const targetKey = rowKey(targetRow)
    if (draggingKey === targetKey) { setDraggingKey(null); setDragOverKey(null); return }

    const sourceGroupId = groups.get(draggingKey)
    const targetGroupId = groups.get(targetKey)
    const joinGroupId = targetGroupId ?? `g${Date.now()}`

    setGroups((prev) => {
      const next = new Map(prev)
      if (!targetGroupId) next.set(targetKey, joinGroupId)
      next.set(draggingKey, joinGroupId)
      if (sourceGroupId && sourceGroupId !== joinGroupId) {
        const remaining = [...next.entries()].filter(([, g]) => g === sourceGroupId)
        if (remaining.length <= 1) remaining.forEach(([k]) => next.delete(k))
      }
      return next
    })

    // Clean up name if the source group dissolved
    if (sourceGroupId && sourceGroupId !== joinGroupId) {
      const remainingAfter = [...groups.entries()].filter(([k, g]) => g === sourceGroupId && k !== draggingKey)
      if (remainingAfter.length <= 1) dissolveGroupName(sourceGroupId)
    }

    setDraggingKey(null)
    setDragOverKey(null)
  }

  function handleDetach(row: DailySummaryRow) {
    const key = rowKey(row)
    const gid = groups.get(key)
    if (!gid) return

    setGroups((prev) => {
      const next = new Map(prev)
      next.delete(key)
      const remaining = [...next.entries()].filter(([, g]) => g === gid)
      if (remaining.length <= 1) remaining.forEach(([k]) => next.delete(k))
      return next
    })

    // Clean up name if group dissolved
    const remainingAfter = [...groups.entries()].filter(([k, g]) => g === gid && k !== key)
    if (remainingAfter.length <= 1) dissolveGroupName(gid)
  }

  function copyReport() {
    const lines: string[] = [`Week of ${weekLabel}`, '']
    groupIds.forEach((gid, i) => {
      const total = getGroupRows(gid).reduce((s, r) => s + r.minutes, 0)
      const label = groupNames.get(gid) ?? `Group ${i + 1}`
      if (total > 0) lines.push(`${label}   ${formatMinutesAsHoursMinutes(total)}`)
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
          inGroup             ? 'report-row--grouped'   : '',
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
                const displayName = groupNames.get(gid) ?? `Group ${i + 1}`
                return (
                  <Fragment key={gid}>
                    <tr className="report-group-header" onClick={toggle}>
                      <td className="report-group-toggle">{collapsed ? '▶' : '▼'}</td>
                      <td colSpan={2}>
                        <button
                          className="report-group-name-btn"
                          onClick={(e) => { e.stopPropagation(); openNaming(gid) }}
                          title="Rename group"
                        >
                          {displayName}
                        </button>
                      </td>
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

      {namingGroupId && (
        <div className="modal-backdrop" onClick={() => setNamingGroupId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Name this group</h3>
            <div className="modal-body">
              <input
                className="group-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyName(nameInput)
                  if (e.key === 'Escape') setNamingGroupId(null)
                }}
                placeholder="Type a name or pick one below…"
                autoFocus
              />
              {suggestions.length > 0 && (
                <ul className="group-name-suggestions">
                  {suggestions.map((t) => (
                    <li key={t}>
                      <button className="group-name-suggestion" onClick={() => applyName(t)}>
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setNamingGroupId(null)}>Cancel</button>
              <button onClick={() => applyName(nameInput)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
