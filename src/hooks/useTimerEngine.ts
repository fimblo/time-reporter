import { useEffect, useRef, useState } from 'react'
import type { AppState, UUID } from '../types'
import { cloneAppState, findActiveInterval, nowIso } from '../lib/timeUtils'

export interface TimerEngine {
  state: AppState
  now: Date
  activeTaskId?: UUID
  startTimer: (taskId: UUID) => void
  pauseTimer: () => void
  updateState: (updater: (prev: AppState) => AppState) => void
}

const TICK_MS = 1000

export function useTimerEngine(
  initial: AppState,
  onChange: (state: AppState) => void,
): TimerEngine {
  const [state, setState] = useState<AppState>(initial)
  const [now, setNow] = useState<Date>(new Date())
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setNow(new Date())
    }, TICK_MS)
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
      }
    }
  }, [])

  const updateState = (updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev)
      onChange(next)
      return next
    })
  }

  const startTimer = (taskId: UUID) => {
    updateState((prev) => {
      const draft = cloneAppState(prev)
      const { tasks } = draft

      const active = findActiveInterval(tasks)
      if (active && active.taskId !== taskId) {
        active.interval.end = nowIso()
      }

      const task = tasks.find((t) => t.id === taskId)
      if (!task) return prev

      const existingActive = task.intervals.find((i) => i.end === null)
      if (existingActive) {
        return draft
      }

      task.intervals.push({
        id: crypto.randomUUID(),
        taskId,
        start: nowIso(),
        end: null,
      })
      task.updatedAt = nowIso()
      draft.lastActiveTaskId = taskId
      return draft
    })
  }

  const pauseTimer = () => {
    updateState((prev) => {
      const draft = cloneAppState(prev)
      const active = findActiveInterval(draft.tasks)
      if (!active) return prev
      active.interval.end = nowIso()
      const task = draft.tasks.find((t) => t.id === active.taskId)
      if (task) {
        task.updatedAt = nowIso()
      }
      return draft
    })
  }

  const active = findActiveInterval(state.tasks)

  return {
    state,
    now,
    activeTaskId: active?.taskId,
    startTimer,
    pauseTimer,
    updateState,
  }
}

