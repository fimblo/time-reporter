import type { DailySummaryRow } from '../types'

export function buildCsvFromDailySummary(rows: DailySummaryRow[]): string {
  const header = ['date', 'client', 'topic', 'minutes', 'hours']
  const lines = [header.join(',')]

  for (const row of rows) {
    const hours = (row.minutes / 60).toFixed(2)
    const values = [
      row.date,
      escapeCsv(row.client),
      escapeCsv(row.topic),
      row.minutes.toString(),
      hours,
    ]
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

