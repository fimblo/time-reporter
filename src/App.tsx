import './App.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TrackingView } from './components/TrackingView'
import { MigrationCheck } from './components/MigrationCheck'
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

// Outer shell: handles async initial load
function App() {
  const [initialState, setInitialState] = useState<AppState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    loadState()
      .then(setInitialState)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (loadError) {
    return (
      <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-danger, red)' }}>Failed to load: {loadError}</p>
      </div>
    )
  }
  if (!initialState) {
    return (
      <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading…</p>
      </div>
    )
  }

  return <AppLoaded initialState={initialState} />
}

// Inner shell: owns all app logic once data is loaded
function AppLoaded({ initialState }: { initialState: AppState }) {
  const [view, setView] = useState<View>('tracking')
  const [showMigrationCheck, setShowMigrationCheck] = useState(false)

  const handleSave = useCallback((state: AppState) => {
    saveState(state).catch(console.error)
  }, [])

  const engine = useTimerEngine(initialState, handleSave)
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

  const maxBarMinutes = Math.max(thisWeek.total, lastWeek.total, avgWeek?.total ?? 0)
  const barMax = maxBarMinutes === 0 ? 1 : maxBarMinutes * 1.1
  const lastWeekBarPct = (lastWeek.total / barMax) * 100
  const thisWeekBarPct = (thisWeek.total / barMax) * 100
  const avgWeekBarPct = avgWeek ? (avgWeek.total / barMax) * 100 : null

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
    engine.updateState((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }))
    if (startRunning) engine.startTimer(newTask.id)
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
            <div className="stat-value-only">{formatMinutesAsHoursMinutes(todayMinutes)}</div>
          </div>
          <hr className="sidebar-divider" />
          <div className="sidebar-stat-group">
            <div className="sidebar-stat-group-title">Weekly</div>
            {maxBarMinutes > 0 && (
              <div className="week-bar-chart">
                <div className="week-bar-label-col">
                  <div className="week-bar-row-label">This</div>
                  <div className="week-bar-row-label">Last</div>
                </div>
                <div className="week-bar-tracks">
                  <div className="week-bar week-bar--this-week" style={{ width: `${thisWeekBarPct}%` }} />
                  <div className="week-bar week-bar--last-week" style={{ width: `${lastWeekBarPct}%` }} />
                  {avgWeekBarPct !== null && (
                    <div className="week-bar-avg-line" style={{ left: `${avgWeekBarPct}%` }} />
                  )}
                </div>
                <div className="week-bar-value-col">
                  <div className="week-bar-row-value">{formatMinutesAsHoursMinutes(thisWeek.total)}</div>
                  <div className="week-bar-row-value">{formatMinutesAsHoursMinutes(lastWeek.total)}</div>
                </div>
              </div>
            )}
            {avgWeek !== null && (
              <div className="week-bar-avg-note">avg {formatMinutesAsHoursMinutes(avgWeek.total)}/wk ({numWeeks}w)</div>
            )}
          </div>
          <hr className="sidebar-divider" />
          <div className="sidebar-stat-group">
            <div className="sidebar-stat-group-title">All time</div>
            <div className="stat-value-only">{formatMinutesAsHoursMinutes(totalMinutes)}</div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="main-header">
          <h2>{view === 'tracking' ? 'Tracking' : 'Overview'}</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {/* TEMPORARY — remove after migration verified */}
            <button onClick={() => setShowMigrationCheck((v) => !v)}>
              {showMigrationCheck ? 'Hide verify' : 'Verify migration'}
            </button>
            <button onClick={exportCsv} disabled={summaryRows.length === 0}>
              Export CSV
            </button>
          </div>
        </header>
        {/* TEMPORARY — remove after migration verified */}
        {showMigrationCheck && <MigrationCheck />}
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
