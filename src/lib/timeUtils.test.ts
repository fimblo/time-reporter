import { describe, it, expect } from 'vitest'
import type { Interval, Task } from '../types'
import {
  formatMinutesAsHoursMinutes,
  formatSecondsAsHoursMinutesSeconds,
  durationMinutes,
  splitIntervalByDay,
  buildDailySummary,
  computeTotalMinutes,
  computeActiveDays,
  computeDailyAverageMinutes,
  computeSecondsToday,
  findActiveInterval,
  cloneAppState,
} from './timeUtils'

describe('formatMinutesAsHoursMinutes', () => {
  it('formats zero as 0m', () => {
    expect(formatMinutesAsHoursMinutes(0)).toBe('0m')
  })
  it('formats minutes only', () => {
    expect(formatMinutesAsHoursMinutes(45)).toBe('45m')
  })
  it('formats hours and minutes', () => {
    expect(formatMinutesAsHoursMinutes(90)).toBe('1h 30m')
  })
  it('formats negative', () => {
    expect(formatMinutesAsHoursMinutes(-60)).toBe('-1h 0m')
  })
})

describe('formatSecondsAsHoursMinutesSeconds', () => {
  it('formats seconds only', () => {
    expect(formatSecondsAsHoursMinutesSeconds(45)).toBe('45s')
  })
  it('formats minutes and seconds', () => {
    expect(formatSecondsAsHoursMinutesSeconds(90)).toBe('1m 30s')
  })
  it('formats hours, minutes and seconds', () => {
    expect(formatSecondsAsHoursMinutesSeconds(3723)).toBe('1h 2m 3s')
  })
})

describe('computeSecondsToday', () => {
  it('returns 0 for task with no intervals', () => {
    const task: Task = {
      id: 't1',
      client: 'A',
      topic: 'T',
      createdAt: '',
      updatedAt: '',
      intervals: [],
    }
    expect(computeSecondsToday(task, '2026-02-19', new Date('2026-02-19T12:00:00.000Z'))).toBe(0)
  })
  it('returns seconds for completed interval on that day', () => {
    const task: Task = {
      id: 't1',
      client: 'A',
      topic: 'T',
      createdAt: '',
      updatedAt: '',
      intervals: [
        {
          id: 'i1',
          taskId: 't1',
          start: '2026-02-19T10:00:00.000Z',
          end: '2026-02-19T10:01:30.000Z',
        },
      ],
    }
    expect(computeSecondsToday(task, '2026-02-19', new Date('2026-02-19T12:00:00.000Z'))).toBe(90)
  })
  it('returns live seconds for active interval on that day', () => {
    const task: Task = {
      id: 't1',
      client: 'A',
      topic: 'T',
      createdAt: '',
      updatedAt: '',
      intervals: [
        {
          id: 'i1',
          taskId: 't1',
          start: '2026-02-19T10:00:00.000Z',
          end: null,
        },
      ],
    }
    const now = new Date('2026-02-19T10:00:02.000Z')
    expect(computeSecondsToday(task, '2026-02-19', now)).toBe(2)
  })
})

describe('durationMinutes', () => {
  it('returns 0 for invalid or reversed range', () => {
    expect(durationMinutes('2026-02-19T10:00:00.000Z', '2026-02-19T09:00:00.000Z')).toBe(0)
  })
  it('returns minutes between two times', () => {
    expect(durationMinutes('2026-02-19T10:00:00.000Z', '2026-02-19T11:30:00.000Z')).toBe(90)
  })
})

describe('splitIntervalByDay', () => {
  it('returns empty for invalid interval', () => {
    const interval: Interval = {
      id: 'i1',
      taskId: 't1',
      start: '2026-02-19T10:00:00.000Z',
      end: '2026-02-19T09:00:00.000Z',
    }
    expect(splitIntervalByDay(interval)).toEqual([])
  })
  it('splits single day into one chunk', () => {
    const interval: Interval = {
      id: 'i1',
      taskId: 't1',
      start: '2026-02-19T10:00:00.000Z',
      end: '2026-02-19T12:00:00.000Z',
    }
    const now = new Date('2026-02-19T15:00:00.000Z')
    const chunks = splitIntervalByDay(interval, now)
    expect(chunks.length).toBe(1)
    expect(chunks[0].minutes).toBe(120)
    expect(chunks[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('splits across midnight when interval spans two calendar days in local time', () => {
    const interval: Interval = {
      id: 'i1',
      taskId: 't1',
      start: '2026-02-19T23:00:00.000Z',
      end: '2026-02-20T01:00:00.000Z',
    }
    const now = new Date('2026-02-20T02:00:00.000Z')
    const chunks = splitIntervalByDay(interval, now)
    const total = chunks.reduce((s, c) => s + c.minutes, 0)
    expect(total).toBe(120)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })
})

describe('buildDailySummary', () => {
  it('returns empty for no tasks', () => {
    expect(buildDailySummary([], new Date())).toEqual([])
  })
  it('aggregates one task with one interval', () => {
    const task: Task = {
      id: 't1',
      client: 'Acme',
      topic: 'Coaching',
      createdAt: '2026-02-19T00:00:00.000Z',
      updatedAt: '2026-02-19T00:00:00.000Z',
      intervals: [
        {
          id: 'i1',
          taskId: 't1',
          start: '2026-02-19T10:00:00.000Z',
          end: '2026-02-19T11:00:00.000Z',
        },
      ],
    }
    const rows = buildDailySummary([task], new Date('2026-02-19T12:00:00.000Z'))
    expect(rows.length).toBe(1)
    expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(rows[0].client).toBe('Acme')
    expect(rows[0].topic).toBe('Coaching')
    expect(rows[0].minutes).toBe(60)
  })
  it('applies overrides', () => {
    const task: Task = {
      id: 't1',
      client: 'Acme',
      topic: 'Coaching',
      createdAt: '2026-02-19T00:00:00.000Z',
      updatedAt: '2026-02-19T00:00:00.000Z',
      intervals: [
        {
          id: 'i1',
          taskId: 't1',
          start: '2026-02-19T10:00:00.000Z',
          end: '2026-02-19T11:00:00.000Z',
        },
      ],
      overrides: [{ date: '2026-02-19', minutesOverride: 90 }],
    }
    const rows = buildDailySummary([task], new Date('2026-02-19T12:00:00.000Z'))
    expect(rows.length).toBe(1)
    expect(rows[0].minutes).toBe(90)
  })
})

describe('computeTotalMinutes', () => {
  it('returns 0 for empty', () => {
    expect(computeTotalMinutes([])).toBe(0)
  })
  it('sums rows', () => {
    expect(
      computeTotalMinutes([
        { date: '2026-02-19', taskId: 't1', client: 'A', topic: 'T', minutes: 60 },
        { date: '2026-02-19', taskId: 't2', client: 'B', topic: 'T', minutes: 30 },
      ]),
    ).toBe(90)
  })
})

describe('computeActiveDays', () => {
  it('returns 0 for empty', () => {
    expect(computeActiveDays([])).toBe(0)
  })
  it('counts unique dates', () => {
    expect(
      computeActiveDays([
        { date: '2026-02-19', taskId: 't1', client: 'A', topic: 'T', minutes: 60 },
        { date: '2026-02-19', taskId: 't2', client: 'B', topic: 'T', minutes: 30 },
        { date: '2026-02-20', taskId: 't1', client: 'A', topic: 'T', minutes: 45 },
      ]),
    ).toBe(2)
  })
})

describe('computeDailyAverageMinutes', () => {
  it('returns 0 for no rows', () => {
    expect(computeDailyAverageMinutes([])).toBe(0)
  })
  it('averages by active days', () => {
    const rows = [
      { date: '2026-02-19', taskId: 't1', client: 'A', topic: 'T', minutes: 60 },
      { date: '2026-02-19', taskId: 't2', client: 'B', topic: 'T', minutes: 40 },
      { date: '2026-02-20', taskId: 't1', client: 'A', topic: 'T', minutes: 20 },
    ]
    expect(computeDailyAverageMinutes(rows)).toBe(60) // 120 total / 2 days
  })
})

describe('findActiveInterval', () => {
  it('returns null for no tasks', () => {
    expect(findActiveInterval([])).toBeNull()
  })
  it('returns null when no interval has end null', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        client: 'A',
        topic: 'T',
        createdAt: '',
        updatedAt: '',
        intervals: [{ id: 'i1', taskId: 't1', start: '', end: '2026-02-19T12:00:00.000Z' }],
      },
    ]
    expect(findActiveInterval(tasks)).toBeNull()
  })
  it('returns task and interval when one has end null', () => {
    const interval: Interval = {
      id: 'i1',
      taskId: 't1',
      start: '2026-02-19T10:00:00.000Z',
      end: null,
    }
    const tasks: Task[] = [
      {
        id: 't1',
        client: 'A',
        topic: 'T',
        createdAt: '',
        updatedAt: '',
        intervals: [interval],
      },
    ]
    const found = findActiveInterval(tasks)
    expect(found).not.toBeNull()
    expect(found!.taskId).toBe('t1')
    expect(found!.interval).toBe(interval)
  })
})

describe('cloneAppState', () => {
  it('returns deep copy', () => {
    const state = { tasks: [{ id: 't1', client: 'A', topic: 'T', createdAt: '', updatedAt: '', intervals: [] }] }
    const cloned = cloneAppState(state as import('../types').AppState)
    expect(cloned).not.toBe(state)
    expect(cloned.tasks).not.toBe(state.tasks)
    expect(cloned.tasks[0].client).toBe('A')
  })
})
