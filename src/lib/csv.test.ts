import { describe, it, expect } from 'vitest'
import type { DailySummaryRow } from '../types'
import { buildCsvFromDailySummary } from './csv'

describe('buildCsvFromDailySummary', () => {
  it('returns header only for empty rows', () => {
    const csv = buildCsvFromDailySummary([])
    expect(csv).toBe('date,client,topic,minutes,hours')
  })
  it('outputs one row with correct columns', () => {
    const rows: DailySummaryRow[] = [
      { date: '2026-02-19', taskId: 't1', client: 'Acme', topic: 'Coaching', minutes: 90 },
    ]
    const csv = buildCsvFromDailySummary(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('date,client,topic,minutes,hours')
    expect(lines[1]).toBe('2026-02-19,Acme,Coaching,90,1.50')
  })
  it('escapes client/topic with commas', () => {
    const rows: DailySummaryRow[] = [
      { date: '2026-02-19', taskId: 't1', client: 'Acme, Inc', topic: 'Coaching', minutes: 60 },
    ]
    const csv = buildCsvFromDailySummary(rows)
    expect(csv).toContain('"Acme, Inc"')
  })
  it('escapes quotes in values', () => {
    const rows: DailySummaryRow[] = [
      { date: '2026-02-19', taskId: 't1', client: 'Acme "Special"', topic: 'T', minutes: 60 },
    ]
    const csv = buildCsvFromDailySummary(rows)
    expect(csv).toContain('""')
  })
})
