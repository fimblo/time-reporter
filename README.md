# time-reporter

A lightweight time tracking app for freelancers and consultants who bill multiple clients.

Track work by client and topic throughout the day, review daily and weekly summaries, and export to CSV for invoicing. Time is stored locally in SQLite — no cloud account required.

## Features

- **Client-focused** — switch between clients with a tab; each client has its own colour and history
- **Interval tracking** — start and stop a timer; intervals are stored and aggregated by day
- **Manual overrides** — adjust reported time for any day directly in the edit dialog; subsequent timer use adds on top
- **Overview** — weekly bar chart and a full history table grouped by week, with edit and delete per entry
- **CSV export** — export per-client time data with a UTF-8 BOM so it opens correctly in Excel and Numbers

## Requirements

- **Node 22 or later** (needed for `--experimental-strip-types`)
- npm (comes with Node)

## Getting started

```bash
npm install
node --experimental-strip-types server/index.ts   # terminal 1 — start backend
npm run dev                                        # terminal 2 — start frontend
```

Then open [http://localhost:5173](http://localhost:5173).

The SQLite database is created automatically on first run at `data/time-reporter.sqlite`.
No `.env.local` is needed — the Vite dev server proxies API requests to the backend automatically.

---

[CLAUDE.md](CLAUDE.md) — architecture and development notes.
[LICENSE](LICENSE)
