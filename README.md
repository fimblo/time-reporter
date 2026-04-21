# time-reporter

A time tracking app. Log work by client and topic, track intervals through the day, and review summaries in the Overview. Export to CSV for invoicing.

State is persisted in SQLite via an Express backend.

## Running

Install dependencies:

```bash
npm install
```

Start the backend (port 3001):

```bash
node --experimental-strip-types server/index.ts
```

Start the frontend dev server (port 5173) in a second terminal:

```bash
npm run dev
```

The frontend is pre-configured to talk to the backend via `VITE_API_URL=http://localhost:3001` in `.env.local`.

## Tests

Frontend (Vitest, jsdom):

```bash
npm run test
```

Backend / database layer (Vitest, Node environment):

```bash
npx vitest run server/db.test.ts
```

Or run everything at once:

```bash
npx vitest run
```

---

[CLAUDE.md](CLAUDE.md) — architecture notes and instructions for AI-assisted development.
