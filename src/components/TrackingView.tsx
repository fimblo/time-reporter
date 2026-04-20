import { useMemo, useState } from 'react'
import type { Task } from '../types'
import {
  formatMinutesAsHoursMinutes,
  formatSecondsAsHoursMinutesSeconds,
  computeSecondsToday,
  splitIntervalByDay,
} from '../lib/timeUtils'

interface TrackingViewProps {
  tasks: Task[]
  now: Date
  activeTaskId?: string
  clientColor: string
  onCreateTask: (topic: string, startRunning: boolean) => void
  onStartTimer: (taskId: string) => void
  onPauseTimer: () => void
  onUpdateTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
}

interface EditableTask extends Task {
  localTopic: string
}

function dateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return dateKeyFromDate(d)
}

function computeMinutesToday(task: Task, todayKey: string, now: Date): number {
  return Math.floor(computeSecondsToday(task, todayKey, now) / 60)
}

function todayKey(now: Date): string {
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function TrackingView(props: TrackingViewProps) {
  const { tasks, now, activeTaskId, clientColor, onCreateTask, onStartTimer, onPauseTimer, onUpdateTask, onDeleteTask } =
    props
  const [topic, setTopic] = useState('')
  const [startRunning, setStartRunning] = useState(true)
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null)
  const [newDateInput, setNewDateInput] = useState(yesterdayKey)

  const today = todayKey(now)

  const tasksWithToday = useMemo(() => {
    return tasks
      .map((task) => ({
        task,
        minutesToday: computeMinutesToday(task, today, now),
      }))
      .filter(
        (t) =>
          t.minutesToday > 0 ||
          taskHasActiveIntervalToday(t.task, today, now) ||
          isCreatedToday(t.task, today),
      )
      .sort((a, b) => b.minutesToday - a.minutesToday)
  }, [tasks, today, now])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    onCreateTask(topic.trim(), startRunning)
    setTopic('')
  }

  function openEdit(task: Task) {
    setEditingTask({ ...task, localTopic: task.topic })
  }

  function updateOverrideMinutes(date: string, minutes: number) {
    if (!editingTask) return
    const overrides = [...(editingTask.overrides ?? [])]
    const idx = overrides.findIndex((o) => o.date === date)
    const setAt = new Date().toISOString()
    if (idx >= 0) {
      overrides[idx] = { ...overrides[idx], minutesOverride: minutes, setAt }
    } else {
      overrides.push({ date, minutesOverride: minutes, setAt })
    }
    setEditingTask({ ...editingTask, overrides })
  }

  function saveEdit() {
    if (!editingTask) return
    const { localTopic, ...rest } = editingTask
    onUpdateTask({ ...rest, topic: localTopic })
    setEditingTask(null)
  }

  const editableDates = useMemo(() => {
    if (!editingTask) return []
    const dates = new Set<string>()
    dates.add(today)
    for (const interval of editingTask.intervals) {
      dates.add(dateKeyFromDate(new Date(interval.start)))
    }
    if (editingTask.overrides) {
      for (const override of editingTask.overrides) {
        dates.add(override.date)
      }
    }
    return Array.from(dates).sort()
  }, [editingTask, today])

  return (
    <div className="tracking-view">
      <section className="panel">
        <h2>New task</h2>
        <form onSubmit={handleCreate} className="new-task-form">
          <label>
            <span>Topic</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Coaching / project / etc."
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={startRunning}
              onChange={(e) => setStartRunning(e.target.checked)}
            />
            <span>Start timer immediately</span>
          </label>
          <button type="submit">Create task</button>
        </form>
      </section>

      <section className="panel">
        <h2>Today&apos;s tasks</h2>
        {tasksWithToday.length === 0 ? (
          <p className="empty">No time tracked yet today.</p>
        ) : (
          <ul className="task-list">
            {tasksWithToday.map(({ task, minutesToday }) => {
              const isActive = activeTaskId === task.id
              return (
                <li
                  key={task.id}
                  className={isActive ? 'task-row active' : 'task-row'}
                  style={{ borderLeftColor: clientColor, borderLeftWidth: '4px' }}
                >
                  <div className="task-main">
                    <div className="task-title">
                      <span className="task-topic">{task.topic || 'No topic'}</span>
                    </div>
                    <div className="task-time">
                      {isActive
                        ? `${formatSecondsAsHoursMinutesSeconds(computeSecondsToday(task, today, now))} today`
                        : `${formatMinutesAsHoursMinutes(minutesToday)} today`}
                    </div>
                  </div>
                  <div className="task-actions">
                    {isActive ? (
                      <button onClick={onPauseTimer}>Pause</button>
                    ) : (
                      <button onClick={() => onStartTimer(task.id)}>Start</button>
                    )}
                    <button onClick={() => openEdit(task)}>Edit</button>
                    <button onClick={() => onDeleteTask(task.id)}>Delete</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {editingTask && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Edit task</h3>
            <div className="modal-body">
              <label>
                <span>Topic</span>
                <input
                  value={editingTask.localTopic}
                  onChange={(e) => setEditingTask({ ...editingTask, localTopic: e.target.value })}
                />
              </label>

              <div className="daily-table">
                <h4>Daily time</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Minutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableDates.map((date) => {
                      const totalMinutes = computeMinutesToday(editingTask, date, now)
                      const hours = Math.floor(totalMinutes / 60)
                      const mins = totalMinutes % 60
                      return (
                        <tr key={date}>
                          <td>{date}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              aria-label={`Hours for ${date}`}
                              value={hours}
                              onChange={(e) => {
                                const h = Number.parseInt(e.target.value, 10) || 0
                                updateOverrideMinutes(date, h * 60 + mins)
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              aria-label={`Minutes for ${date}`}
                              value={mins}
                              onChange={(e) => {
                                const m = Math.min(59, Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                                updateOverrideMinutes(date, hours * 60 + m)
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="add-date-row">
                  <input
                    type="date"
                    value={newDateInput}
                    max={today}
                    onChange={(e) => setNewDateInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newDateInput && !editableDates.includes(newDateInput)) {
                        updateOverrideMinutes(newDateInput, 0)
                      }
                    }}
                    disabled={!newDateInput || editableDates.includes(newDateInput)}
                  >
                    Add date
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditingTask(null)}>Cancel</button>
              <button onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function taskHasActiveIntervalToday(task: Task, todayKeyValue: string, now: Date): boolean {
  return task.intervals.some((interval) => {
    if (interval.end !== null) return false
    const chunks = splitIntervalByDay(interval, now)
    return chunks.some((chunk) => chunk.date === todayKeyValue && chunk.minutes > 0)
  })
}

function isCreatedToday(task: Task, todayKey: string): boolean {
  const createdDate = new Date(task.createdAt)
  const year = createdDate.getFullYear()
  const month = `${createdDate.getMonth() + 1}`.padStart(2, '0')
  const day = `${createdDate.getDate()}`.padStart(2, '0')
  const key = `${year}-${month}-${day}`
  return key === todayKey
}
