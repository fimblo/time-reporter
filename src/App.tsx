import './App.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TrackingView } from './components/TrackingView'
import { OverviewView } from './components/OverviewView'
import { ClientsView } from './components/ClientsView'
import type { AppState, Client, Task } from './types'
import { loadState, saveState, loadClients, createClientApi } from './lib/storage'
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
        <p style={{ color: 'red' }}>Failed to load: {loadError}</p>
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
  const [showClients, setShowClients] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const handleSave = useCallback((state: AppState) => {
    saveState(state).catch(console.error)
  }, [])

  const engine = useTimerEngine(initialState, handleSave)
  const { state, now } = engine

  async function refreshClients() {
    const fetched = await loadClients()
    setClients(fetched)
    return fetched
  }

  // Initial client fetch
  useEffect(() => {
    refreshClients().then((fetched) => {
      if (fetched.length === 0) {
        setShowClients(true)
      } else {
        const first = fetched.find((c) => c.visibleInTabs) ?? fetched[0]
        setSelectedClientId(first.id)
      }
    })
  }, [])

  function handleClientCreated(client: Client) {
    setSelectedClientId(client.id)
    setShowClients(false)
    setView('tracking')
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null
  const visibleClients = clients.filter((c) => c.visibleInTabs)

  // Filter all data to selected client
  const clientTasks = useMemo(
    () => state.tasks.filter((t) => t.client === selectedClient?.name),
    [state.tasks, selectedClient],
  )

  const summaryRows = useMemo(() => buildDailySummary(clientTasks, now), [clientTasks, now])

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
    link.download = `time-report-${selectedClient?.name ?? 'export'}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleCreateTask(topic: string, startRunning: boolean) {
    if (!selectedClient) return
    const createdAt = new Date().toISOString()
    const newTask: Task = {
      id: crypto.randomUUID(),
      client: selectedClient.name,
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

  function selectClient(clientId: string) {
    setSelectedClientId(clientId)
    setShowClients(false)
  }

  const pageTitle = showClients
    ? 'Manage clients'
    : view === 'tracking'
    ? selectedClient?.name ?? 'Tracking'
    : selectedClient?.name ?? 'Overview'

  return (
    <div className="app-root">
      <aside className="sidebar">
        <h1 className="app-title">Time Reporter</h1>
        <div className="sidebar-footer">
          {selectedClient && (
            <>
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
            </>
          )}
        </div>
      </aside>

      <main className="main">
        {/* Client tab bar */}
        <div className="client-tabs">
          {visibleClients.map((c) => (
            <button
              key={c.id}
              className={`client-tab${!showClients && selectedClientId === c.id ? ' active' : ''}`}
              onClick={() => selectClient(c.id)}
            >
              <span className="client-tab-dot" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
          <button
            className={`client-tab client-tab-manage${showClients ? ' active' : ''}`}
            onClick={() => setShowClients(true)}
          >
            Manage
          </button>
        </div>

        {/* View sub-tabs (only when a client is selected) */}
        {!showClients && selectedClient && (
          <div className="view-tabs">
            <button
              className={`view-tab${view === 'tracking' ? ' active' : ''}`}
              onClick={() => setView('tracking')}
            >
              Tracking
            </button>
            <button
              className={`view-tab${view === 'overview' ? ' active' : ''}`}
              onClick={() => setView('overview')}
            >
              Overview
            </button>
            <div className="view-tabs-spacer" />
            <button onClick={exportCsv} disabled={summaryRows.length === 0}>
              Export CSV
            </button>
          </div>
        )}

        <section className="main-content">
          {showClients ? (
            <ClientsView
              clients={clients}
              onRefresh={refreshClients}
              onClientCreated={handleClientCreated}
            />
          ) : !selectedClient ? (
            <p className="empty" style={{ padding: '1rem' }}>
              No client selected. Add one in{' '}
              <button className="link-button" onClick={() => setShowClients(true)}>
                Manage clients
              </button>
              .
            </p>
          ) : view === 'tracking' ? (
            <TrackingView
              tasks={clientTasks}
              now={now}
              activeTaskId={engine.activeTaskId}
              clientColor={selectedClient.color}
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
