import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrackingView } from './TrackingView'
import type { Task } from '../types'

const now = new Date('2026-02-19T12:00:00.000Z')

const baseProps = {
  tasks: [] as Task[],
  now,
  clientColor: '#6366f1',
  onCreateTask: vi.fn(),
  onStartTimer: vi.fn(),
  onPauseTimer: vi.fn(),
  onUpdateTask: vi.fn(),
  onDeleteTask: vi.fn(),
}

describe('TrackingView', () => {
  it('calls onCreateTask when form is submitted with a topic', () => {
    const onCreateTask = vi.fn()
    render(<TrackingView {...baseProps} onCreateTask={onCreateTask} />)
    fireEvent.change(screen.getByPlaceholderText(/coaching|project/i), { target: { value: 'Coaching' } })
    fireEvent.click(screen.getByRole('button', { name: /create task/i }))
    expect(onCreateTask).toHaveBeenCalledWith('Coaching', true)
  })

  it('shows a task created today in the list even with 0 minutes', () => {
    const newTask: Task = {
      id: 'new-1',
      client: 'Acme Corp',
      topic: 'Coaching',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      intervals: [],
    }
    render(<TrackingView {...baseProps} tasks={[newTask]} />)
    expect(screen.getByText('Coaching')).toBeInTheDocument()
  })

  it('does not call onCreateTask when topic is empty', () => {
    const onCreateTask = vi.fn()
    render(<TrackingView {...baseProps} onCreateTask={onCreateTask} />)
    fireEvent.click(screen.getByRole('button', { name: /create task/i }))
    expect(onCreateTask).not.toHaveBeenCalled()
  })

  it('displays time spent today for each task', () => {
    const taskWithTime: Task = {
      id: 't1',
      client: 'Acme',
      topic: 'Coaching',
      createdAt: '2026-02-19T08:00:00.000Z',
      updatedAt: '2026-02-19T10:00:00.000Z',
      intervals: [
        { id: 'i1', taskId: 't1', start: '2026-02-19T09:00:00.000Z', end: '2026-02-19T10:30:00.000Z' },
      ],
    }
    render(<TrackingView {...baseProps} tasks={[taskWithTime]} />)
    expect(screen.getByText(/1h 30m today/)).toBeInTheDocument()
  })

  it('displays time including active interval and increases when now advances', () => {
    const baseTime = new Date('2026-02-19T10:00:00.000Z')
    const taskWithActiveInterval: Task = {
      id: 't1',
      client: 'Acme',
      topic: 'Coaching',
      createdAt: '2026-02-19T08:00:00.000Z',
      updatedAt: '2026-02-19T10:00:00.000Z',
      intervals: [{ id: 'i1', taskId: 't1', start: '2026-02-19T10:00:00.000Z', end: null }],
    }
    const { rerender } = render(
      <TrackingView {...baseProps} tasks={[taskWithActiveInterval]} now={baseTime} activeTaskId="t1" />,
    )
    const initialText = screen.getByText(/today$/).textContent ?? ''

    rerender(
      <TrackingView
        {...baseProps}
        tasks={[taskWithActiveInterval]}
        now={new Date('2026-02-19T10:01:00.000Z')}
        activeTaskId="t1"
      />,
    )
    const laterText = screen.getByText(/today$/).textContent ?? ''
    expect(laterText).not.toBe(initialText)
    expect(laterText).toMatch(/\d+(h|m)/)
  })

  it('calls onDeleteTask with task id when Delete is clicked', () => {
    const task: Task = {
      id: 'task-to-delete',
      client: 'Acme',
      topic: 'Coaching',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      intervals: [],
    }
    const onDeleteTask = vi.fn()
    render(<TrackingView {...baseProps} tasks={[task]} onDeleteTask={onDeleteTask} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDeleteTask).toHaveBeenCalledWith('task-to-delete')
  })

  it('each task row has a Delete button', () => {
    const tasks: Task[] = [
      { id: 't1', client: 'Client A', topic: 'Topic 1', createdAt: now.toISOString(), updatedAt: now.toISOString(), intervals: [] },
      { id: 't2', client: 'Client B', topic: 'Topic 2', createdAt: now.toISOString(), updatedAt: now.toISOString(), intervals: [] },
    ]
    render(<TrackingView {...baseProps} tasks={tasks} />)
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2)
  })

  it('displays time with seconds for the active task so it can increase every second', () => {
    const taskWithActiveInterval: Task = {
      id: 't1',
      client: 'Acme',
      topic: 'Coaching',
      createdAt: '2026-02-19T08:00:00.000Z',
      updatedAt: '2026-02-19T10:00:00.000Z',
      intervals: [{ id: 'i1', taskId: 't1', start: '2026-02-19T10:00:00.000Z', end: null }],
    }
    render(
      <TrackingView
        {...baseProps}
        tasks={[taskWithActiveInterval]}
        now={new Date('2026-02-19T10:00:01.500Z')}
        activeTaskId="t1"
      />,
    )
    expect(screen.getByText(/1s today|0m 1s today|\d+s today/)).toBeInTheDocument()
  })
})
