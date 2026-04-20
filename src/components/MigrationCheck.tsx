// TEMPORARY — remove after migration to SQLite is verified
import { useState } from 'react'
import type { AppState } from '../types'
import { buildDailySummary, computeTotalMinutes } from '../lib/timeUtils'

const STORAGE_KEY = 'time-reporter-state-v1'
const API_URL = import.meta.env.VITE_API_URL as string | undefined

interface Result {
  tasks: { ls: number; api: number }
  intervals: { ls: number; api: number }
  minutes: { ls: number; api: number }
  ok: boolean
}

export function MigrationCheck() {
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function check() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      if (!API_URL) throw new Error('VITE_API_URL not set')

      const res = await fetch(`${API_URL}/api/state`)
      if (!res.ok) throw new Error(`API ${res.status}`)
      const apiState = (await res.json()) as AppState

      const lsRaw = window.localStorage.getItem(STORAGE_KEY)
      const lsState: AppState = lsRaw ? (JSON.parse(lsRaw) as AppState) : { tasks: [] }

      const lsTasks = lsState.tasks.length
      const apiTasks = apiState.tasks.length
      const lsIntervals = lsState.tasks.reduce((s, t) => s + t.intervals.length, 0)
      const apiIntervals = apiState.tasks.reduce((s, t) => s + t.intervals.length, 0)
      const lsMinutes = computeTotalMinutes(buildDailySummary(lsState.tasks))
      const apiMinutes = computeTotalMinutes(buildDailySummary(apiState.tasks))

      setResult({
        tasks: { ls: lsTasks, api: apiTasks },
        intervals: { ls: lsIntervals, api: apiIntervals },
        minutes: { ls: lsMinutes, api: apiMinutes },
        ok: lsTasks === apiTasks && lsIntervals === apiIntervals && lsMinutes === apiMinutes,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="migration-check">
      <div className="migration-check-header">
        <strong>Migration check</strong>
        <button onClick={check} disabled={loading}>
          {loading ? 'Checking…' : 'Run check'}
        </button>
      </div>
      {error && <div className="migration-check-error">{error}</div>}
      {result && (
        <table className="migration-check-table">
          <thead>
            <tr><th></th><th>localStorage</th><th>SQLite</th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Tasks</td>
              <td>{result.tasks.ls}</td>
              <td>{result.tasks.api}</td>
              <td>{result.tasks.ls === result.tasks.api ? '✓' : '✗'}</td>
            </tr>
            <tr>
              <td>Intervals</td>
              <td>{result.intervals.ls}</td>
              <td>{result.intervals.api}</td>
              <td>{result.intervals.ls === result.intervals.api ? '✓' : '✗'}</td>
            </tr>
            <tr>
              <td>Total minutes</td>
              <td>{result.minutes.ls}</td>
              <td>{result.minutes.api}</td>
              <td>{result.minutes.ls === result.minutes.api ? '✓' : '✗'}</td>
            </tr>
          </tbody>
        </table>
      )}
      {result && (
        <div className={result.ok ? 'migration-ok' : 'migration-mismatch'}>
          {result.ok ? '✓ Data matches — safe to clear localStorage' : '✗ Mismatch — do not clear localStorage yet'}
        </div>
      )}
    </div>
  )
}
