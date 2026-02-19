import './App.css'
import { useMemo, useState } from 'react'
import { TrackingView } from './components/TrackingView'
import type { AppState, Task } from './types'
import { loadState, saveState } from './lib/storage'
import { useTimerEngine } from './hooks/useTimerEngine'
import { buildDailySummary, computeDailyAverageMinutes, computeTotalMinutes, formatMinutesAsHoursMinutes } from './lib/timeUtils'
import { OverviewView } from './components/OverviewView'
import { buildCsvFromDailySummary } from './lib/csv'

type View = 'tracking' | 'overview'

const initialState: AppState = loadState()

function App() {
  const [view, setView] = useState<View>('tracking')
  const engine = useTimerEngine(initialState, saveState)
  const { state, now } = engine

  const summaryRows = useMemo(() => buildDailySummary(state.tasks, now), [state.tasks, now])
  const totalMinutes = computeTotalMinutes(summaryRows)
  const dailyAverageMinutes = computeDailyAverageMinutes(summaryRows)

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
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{formatMinutesAsHoursMinutes(totalMinutes)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Daily avg</span>
            <span className="stat-value">
              {formatMinutesAsHoursMinutes(dailyAverageMinutes)}
            </span>
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
            />
          ) : (
            <OverviewView rows={summaryRows} />
          )}
        </section>
      </main>
    </div>
  )
}

export default App
