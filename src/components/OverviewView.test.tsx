import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverviewView } from './OverviewView'
import type { DailySummaryRow, Task } from '../types'

// A Tuesday — well within a week, no edge cases around week boundaries
const now = new Date('2026-04-21T12:00:00Z')

function makeRow(overrides: Partial<DailySummaryRow> = {}): DailySummaryRow {
  return {
    date: '2026-04-21',
    taskId: 't1',
    client: 'Acme',
    topic: 'Coaching',
    minutes: 60,
    lastStart: '2026-04-21T09:00:00.000Z',
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    client: 'Acme',
    topic: 'Coaching',
    createdAt: '2026-04-21T09:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
    intervals: [],
    ...overrides,
  }
}

const baseProps = {
  rows: [] as DailySummaryRow[],
  tasks: [] as Task[],
  now,
  onUpdateTask: vi.fn(),
}

describe('OverviewView', () => {
  it('shows empty message when there are no rows', () => {
    render(<OverviewView {...baseProps} />)
    expect(screen.getByText(/no entries/i)).toBeInTheDocument()
  })

  it('renders a row with its date, topic and time', () => {
    const row = makeRow({ topic: 'Deep work', minutes: 90 })
    render(<OverviewView {...baseProps} rows={[row]} tasks={[makeTask({ topic: 'Deep work' })]} />)
    expect(screen.getByText('Deep work')).toBeInTheDocument()
    // The detail table <td> should contain the formatted time
    const timeCells = screen.getAllByText('1h 30m')
    expect(timeCells.some((el) => el.tagName === 'TD')).toBe(true)
  })

  it('does not display rows with 0 minutes', () => {
    const zeroRow = makeRow({ minutes: 0, topic: 'Deleted entry' })
    render(<OverviewView {...baseProps} rows={[zeroRow]} tasks={[makeTask()]} />)
    expect(screen.queryByText('Deleted entry')).not.toBeInTheDocument()
  })

  it('shows Edit and Delete buttons on each data row', () => {
    const row = makeRow()
    render(<OverviewView {...baseProps} rows={[row]} tasks={[makeTask()]} />)
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('Delete calls onUpdateTask with a 0-minute override for that date', () => {
    const onUpdateTask = vi.fn()
    const row = makeRow({ date: '2026-04-21', minutes: 60 })
    const task = makeTask()
    render(<OverviewView {...baseProps} rows={[row]} tasks={[task]} onUpdateTask={onUpdateTask} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onUpdateTask).toHaveBeenCalledOnce()
    const updated: Task = onUpdateTask.mock.calls[0][0]
    const override = updated.overrides?.find((o) => o.date === '2026-04-21')
    expect(override?.minutesOverride).toBe(0)
    expect(override?.setAt).toBeUndefined()
  })

  it('Edit opens a modal pre-filled with the row values', () => {
    const row = makeRow({ date: '2026-04-21', topic: 'Coaching', minutes: 90 })
    render(<OverviewView {...baseProps} rows={[row]} tasks={[makeTask()]} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByDisplayValue('2026-04-21')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Coaching')).toBeInTheDocument()
    // 90 min = 1h 30m
    expect(screen.getByDisplayValue('1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
  })

  it('Cancel closes the modal without calling onUpdateTask', () => {
    const onUpdateTask = vi.fn()
    const row = makeRow()
    render(<OverviewView {...baseProps} rows={[row]} tasks={[makeTask()]} onUpdateTask={onUpdateTask} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    expect(onUpdateTask).not.toHaveBeenCalled()
  })

  it('Save with changed minutes calls onUpdateTask with a legacy override', () => {
    const onUpdateTask = vi.fn()
    const row = makeRow({ date: '2026-04-21', minutes: 60 })
    const task = makeTask()
    render(<OverviewView {...baseProps} rows={[row]} tasks={[task]} onUpdateTask={onUpdateTask} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    // Change hours from 1 to 2
    const hoursInput = screen.getByDisplayValue('1')
    fireEvent.change(hoursInput, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onUpdateTask).toHaveBeenCalledOnce()
    const updated: Task = onUpdateTask.mock.calls[0][0]
    const override = updated.overrides?.find((o) => o.date === '2026-04-21')
    expect(override?.minutesOverride).toBe(120) // 2h = 120min
    expect(override?.setAt).toBeUndefined()
  })

  it('Save with changed date zeroes old date and sets minutes on new date', () => {
    const onUpdateTask = vi.fn()
    const row = makeRow({ date: '2026-04-21', minutes: 60 })
    const task = makeTask()
    render(<OverviewView {...baseProps} rows={[row]} tasks={[task]} onUpdateTask={onUpdateTask} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    const dateInput = screen.getByDisplayValue('2026-04-21')
    fireEvent.change(dateInput, { target: { value: '2026-04-20' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    const updated: Task = onUpdateTask.mock.calls[0][0]
    const oldDateOverride = updated.overrides?.find((o) => o.date === '2026-04-21')
    const newDateOverride = updated.overrides?.find((o) => o.date === '2026-04-20')
    expect(oldDateOverride?.minutesOverride).toBe(0)
    expect(newDateOverride?.minutesOverride).toBe(60)
  })
})
