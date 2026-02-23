import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrackingView } from './TrackingView'
import type { Task } from '../types'

const now = new Date('2026-02-19T12:00:00.000Z')

describe('TrackingView', () => {
  it('calls onCreateTask when form is submitted with client and topic', () => {
    const onCreateTask = vi.fn()
    render(
      <TrackingView
        tasks={[]}
        now={now}
        onCreateTask={onCreateTask}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )
    const clientInput = screen.getByPlaceholderText(/client name/i)
    const topicInput = screen.getByPlaceholderText(/coaching|project/i)
    fireEvent.change(clientInput, { target: { value: 'Acme Corp' } })
    fireEvent.change(topicInput, { target: { value: 'Coaching' } })
    fireEvent.click(screen.getByRole('button', { name: /create task/i }))
    expect(onCreateTask).toHaveBeenCalledWith('Acme Corp', 'Coaching', true)
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
    render(
      <TrackingView
        tasks={[newTask]}
        now={now}
        onCreateTask={vi.fn()}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Coaching')).toBeInTheDocument()
  })

  it('does not call onCreateTask when both client and topic are empty', () => {
    const onCreateTask = vi.fn()
    render(
      <TrackingView
        tasks={[]}
        now={now}
        onCreateTask={onCreateTask}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )
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
        {
          id: 'i1',
          taskId: 't1',
          start: '2026-02-19T09:00:00.000Z',
          end: '2026-02-19T10:30:00.000Z',
        },
      ],
    }
    render(
      <TrackingView
        tasks={[taskWithTime]}
        now={now}
        onCreateTask={vi.fn()}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )
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
      intervals: [
        {
          id: 'i1',
          taskId: 't1',
          start: '2026-02-19T10:00:00.000Z',
          end: null,
        },
      ],
    }
    const { rerender } = render(
      <TrackingView
        tasks={[taskWithActiveInterval]}
        now={baseTime}
        activeTaskId="t1"
        onCreateTask={vi.fn()}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )
    const timeEl = screen.getByText(/today$/)
    const initialText = timeEl.textContent ?? ''

    const oneMinuteLater = new Date('2026-02-19T10:01:00.000Z')
    rerender(
      <TrackingView
        tasks={[taskWithActiveInterval]}
        now={oneMinuteLater}
        activeTaskId="t1"
        onCreateTask={vi.fn()}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
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
    render(
      <TrackingView
        tasks={[task]}
        now={now}
        onCreateTask={vi.fn()}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={onDeleteTask}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDeleteTask).toHaveBeenCalledWith('task-to-delete')
  })

  it('each task row has a Delete button', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        client: 'Client A',
        topic: 'Topic 1',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        intervals: [],
      },
      {
        id: 't2',
        client: 'Client B',
        topic: 'Topic 2',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        intervals: [],
      },
    ]
    render(
      <TrackingView
        tasks={tasks}
        now={now}
        onCreateTask={vi.fn()}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    expect(deleteButtons).toHaveLength(2)
  })

  it('displays time with seconds for the active task so it can increase every second', () => {
    const baseTime = new Date('2026-02-19T10:00:00.000Z')
    const taskWithActiveInterval: Task = {
      id: 't1',
      client: 'Acme',
      topic: 'Coaching',
      createdAt: '2026-02-19T08:00:00.000Z',
      updatedAt: '2026-02-19T10:00:00.000Z',
      intervals: [
        {
          id: 'i1',
          taskId: 't1',
          start: '2026-02-19T10:00:00.000Z',
          end: null,
        },
      ],
    }
    render(
      <TrackingView
        tasks={[taskWithActiveInterval]}
        now={new Date('2026-02-19T10:00:01.500Z')}
        activeTaskId="t1"
        onCreateTask={vi.fn()}
        onStartTimer={vi.fn()}
        onPauseTimer={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )
    expect(screen.getByText(/1s today|0m 1s today|\d+s today/)).toBeInTheDocument()
  })
})
