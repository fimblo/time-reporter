import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { createClient, createInvoice, deleteInvoice, loadAppState, loadClients, loadReportGroups, saveAppState, saveReportGroups, updateClient, updateInvoice } from './db.ts'

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10)

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

// ── Clients ──────────────────────────────────────────────────────────────────

app.get('/api/clients', (_req: Request, res: Response) => {
  try {
    res.json(loadClients())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' })
  }
})

app.post('/api/clients', (req: Request, res: Response) => {
  try {
    const client = createClient(req.body)
    res.status(201).json(client)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' })
  }
})

app.put('/api/clients/:id', (req: Request, res: Response) => {
  try {
    updateClient(req.params.id, req.body)
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' })
  }
})

// ── Invoices ─────────────────────────────────────────────────────────────────

app.post('/api/clients/:id/invoices', (req: Request, res: Response) => {
  try {
    const invoice = createInvoice(req.params.id, req.body)
    res.status(201).json(invoice)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' })
  }
})

app.patch('/api/clients/:id/invoices/:invoiceId', (req: Request, res: Response) => {
  try {
    updateInvoice(req.params.id, req.params.invoiceId, req.body)
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' })
  }
})

app.delete('/api/clients/:id/invoices/:invoiceId', (req: Request, res: Response) => {
  try {
    deleteInvoice(req.params.id, req.params.invoiceId)
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' })
  }
})

// ── App state ────────────────────────────────────────────────────────────────

app.get('/api/state', (_req: Request, res: Response) => {
  try {
    res.json(loadAppState())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' })
  }
})

app.put('/api/state', (req: Request, res: Response) => {
  try {
    saveAppState(req.body)
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' })
  }
})

// ── Report groups ────────────────────────────────────────────────────────────

app.get('/api/report-groups', (_req: Request, res: Response) => {
  try {
    res.json(loadReportGroups())
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' })
  }
})

app.put('/api/report-groups', (req: Request, res: Response) => {
  try {
    saveReportGroups(req.body)
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' })
  }
})

app.listen(PORT, () => {
  console.log(`time-reporter API listening on http://localhost:${PORT}`)
  console.log(`SQLite DB: ${process.env.TIME_REPORTER_DB ?? '(default ./data/time-reporter.sqlite)'}`)
})
