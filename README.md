# time-reporter

A lightweight time tracking app for freelancers and consultants who bill multiple clients.

Track work by client and topic throughout the day, review daily and weekly summaries, and export to CSV for invoicing. Time is stored locally in SQLite — no cloud account required.

## Features

- **Client-focused** — switch between clients with a tab; each client has its own colour and history
- **Interval tracking** — start and stop a timer; intervals are stored and aggregated by day
- **Manual overrides** — adjust reported time for any day directly in the edit dialog; subsequent timer use adds on top
- **Overview** — weekly bar chart and a full history table grouped by week, with totals
- **CSV export** — export per-client time data with a UTF-8 BOM so it opens correctly in Excel and Numbers

## Getting started

Install dependencies and start the backend and frontend:

```bash
npm install
node --experimental-strip-types server/index.ts   # terminal 1
npm run dev                                        # terminal 2
```

Then open [http://localhost:5173](http://localhost:5173).

---

[CLAUDE.md](CLAUDE.md) — architecture and development notes.
[LICENSE](LICENSE)
