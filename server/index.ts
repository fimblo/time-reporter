import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { createClient, loadAppState, loadClients, saveAppState, updateClient } from './db.ts'

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

app.listen(PORT, () => {
  console.log(`time-reporter API listening on http://localhost:${PORT}`)
  console.log(`SQLite DB: ${process.env.TIME_REPORTER_DB ?? '(default ./data/time-reporter.sqlite)'}`)
})
