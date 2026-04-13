import './App.css'
import { useMemo, useState } from 'react'
import { TrackingView } from './components/TrackingView'
import type { AppState, Task } from './types'
import { loadState, saveState } from './lib/storage'
import { useTimerEngine } from './hooks/useTimerEngine'
import {
  addDays,
  buildDailySummary,
  computeActiveDays,
  computeDailyAverageMinutes,
  computeStdDevMinutes,
  computeTotalMinutes,
  dateKeyFromDate,
  formatMinutesAsHoursMinutes,
  getMondayOfWeek,
} from './lib/timeUtils'
import { OverviewView } from './components/OverviewView'
import { buildCsvFromDailySummary } from './lib/csv'

type View = 'tracking' | 'overview'

const initialState: AppState = loadState()

function App() {
  const [view, setView] = useState<View>('tracking')
  const engine = useTimerEngine(initialState, saveState)
  const { state, now } = engine

  const summaryRows = useMemo(() => buildDailySummary(state.tasks, now), [state.tasks, now])

  const todayKey = dateKeyFromDate(now)
  const thisWeekMonday = getMondayOfWeek(todayKey)
  const lastWeekMonday = addDays(thisWeekMonday, -7)
  const lastWeekSunday = addDays(thisWeekMonday, -1)

  const thisWeekRows = summaryRows.filter((r) => r.date >= thisWeekMonday && r.date <= todayKey)
  const lastWeekRows = summaryRows.filter((r) => r.date >= lastWeekMonday && r.date <= lastWeekSunday)

  const thisWeek = {
    total: computeTotalMinutes(thisWeekRows),
    days: computeActiveDays(thisWeekRows),
    avg: computeDailyAverageMinutes(thisWeekRows),
    stddev: computeStdDevMinutes(thisWeekRows),
  }
  const lastWeek = {
    total: computeTotalMinutes(lastWeekRows),
    days: computeActiveDays(lastWeekRows),
    avg: computeDailyAverageMinutes(lastWeekRows),
    stddev: computeStdDevMinutes(lastWeekRows),
  }
  const todayMinutes = computeTotalMinutes(summaryRows.filter((r) => r.date === todayKey))

  // Per-week stats across all completed weeks (current week excluded)
  const completedWeekMap = new Map<string, typeof summaryRows>()
  for (const row of summaryRows) {
    const monday = getMondayOfWeek(row.date)
    if (monday === thisWeekMonday) continue
    const bucket = completedWeekMap.get(monday)
    if (bucket) bucket.push(row)
    else completedWeekMap.set(monday, [row])
  }
  const completedWeeks = Array.from(completedWeekMap.values()).map((rows) => ({
    total: computeTotalMinutes(rows),
    days: computeActiveDays(rows),
    avg: computeDailyAverageMinutes(rows),
    stddev: computeStdDevMinutes(rows),
  }))
  const numWeeks = completedWeeks.length
  const avgWeek = numWeeks === 0 ? null : {
    total: Math.round(completedWeeks.reduce((s, w) => s + w.total, 0) / numWeeks),
    days: Math.round((completedWeeks.reduce((s, w) => s + w.days, 0) / numWeeks) * 10) / 10,
    avg: Math.round(completedWeeks.reduce((s, w) => s + w.avg, 0) / numWeeks),
    stddev: Math.round(completedWeeks.reduce((s, w) => s + w.stddev, 0) / numWeeks),
  }

  const totalMinutes = computeTotalMinutes(summaryRows)

  function exportCsv() {
    if (summaryRows.length === 0) return
    const csv = buildCsvFromDailySummary(summaryRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'time-report.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleCreateTask(client: string, topic: string, startRunning: boolean) {
    const createdAt = new Date().toISOString()
    const newTask: Task = {
      id: crypto.randomUUID(),
      client,
      topic,
      createdAt,
      updatedAt: createdAt,
      intervals: [],
    }
    engine.updateState((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }))
    if (startRunning) {
      engine.startTimer(newTask.id)
    }
  }

  function handleUpdateTask(updated: Task) {
    const updatedAt = new Date().toISOString()
    engine.updateState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === updated.id ? { ...updated, updatedAt } : t)),
    }))
  }

  function handleDeleteTask(taskId: string) {
    engine.updateState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }))
  }

  return (
    <div className="app-root">
      <aside className="sidebar">
        <h1 className="app-title">Time Reporter</h1>
        <nav className="nav">
          <button
            className={view === 'tracking' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('tracking')}
          >
            Tracking
          </button>
          <button
            className={view === 'overview' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('overview')}
          >
            Overview
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-stat-group">
            <div className="sidebar-stat-group-title">Today</div>
            <div className="stat"><span className="stat-label">Total</span><span className="stat-value">{formatMinutesAsHoursMinutes(todayMinutes)}</span></div>
          </div>
          <hr className="sidebar-divider" />
          <div className="sidebar-stat-group">
            <div className="sidebar-stat-group-title">This week</div>
            <div className="stat"><span className="stat-label">Total</span><span className="stat-value">{formatMinutesAsHoursMinutes(thisWeek.total)}</span></div>
            <div className="stat"><span className="stat-label">Days</span><span className="stat-value">{thisWeek.days}</span></div>
            <div className="stat"><span className="stat-label">Avg/day</span><span className="stat-value">{formatMinutesAsHoursMinutes(thisWeek.avg)}</span></div>
            <div className="stat"><span className="stat-label">Std dev</span><span className="stat-value">{formatMinutesAsHoursMinutes(thisWeek.stddev)}</span></div>
          </div>
          <hr className="sidebar-divider" />
          <div className="sidebar-stat-group">
            <div className="sidebar-stat-group-title">Last week</div>
            <div className="stat"><span className="stat-label">Total</span><span className="stat-value">{formatMinutesAsHoursMinutes(lastWeek.total)}</span></div>
            <div className="stat"><span className="stat-label">Days</span><span className="stat-value">{lastWeek.days}</span></div>
            <div className="stat"><span className="stat-label">Avg/day</span><span className="stat-value">{formatMinutesAsHoursMinutes(lastWeek.avg)}</span></div>
            <div className="stat"><span className="stat-label">Std dev</span><span className="stat-value">{formatMinutesAsHoursMinutes(lastWeek.stddev)}</span></div>
          </div>
          <hr className="sidebar-divider" />
          {avgWeek !== null && (
            <>
              <div className="sidebar-stat-group">
                <div className="sidebar-stat-group-title">Avg week <span className="sidebar-stat-group-note">({numWeeks}w)</span></div>
                <div className="stat"><span className="stat-label">Total</span><span className="stat-value">{formatMinutesAsHoursMinutes(avgWeek.total)}</span></div>
                <div className="stat"><span className="stat-label">Days</span><span className="stat-value">{String(avgWeek.days)}</span></div>
                <div className="stat"><span className="stat-label">Avg/day</span><span className="stat-value">{formatMinutesAsHoursMinutes(avgWeek.avg)}</span></div>
                <div className="stat"><span className="stat-label">Std dev</span><span className="stat-value">{formatMinutesAsHoursMinutes(avgWeek.stddev)}</span></div>
              </div>
              <hr className="sidebar-divider" />
            </>
          )}
          <div className="sidebar-stat-group">
            <div className="sidebar-stat-group-title">All time</div>
            <div className="stat"><span className="stat-label">Total</span><span className="stat-value">{formatMinutesAsHoursMinutes(totalMinutes)}</span></div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="main-header">
          <h2>{view === 'tracking' ? 'Tracking' : 'Overview'}</h2>
          <button onClick={exportCsv} disabled={summaryRows.length === 0}>
            Export CSV
          </button>
        </header>
        <section className="main-content">
          {view === 'tracking' ? (
            <TrackingView
              tasks={state.tasks}
              now={now}
              activeTaskId={engine.activeTaskId}
              onCreateTask={handleCreateTask}
              onStartTimer={engine.startTimer}
              onPauseTimer={engine.pauseTimer}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          ) : (
            <OverviewView rows={summaryRows} now={now} />
          )}
        </section>
      </main>
    </div>
  )
}

export default App
