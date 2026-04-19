# time-reporter

A simple time tracking app. Log work by client and topic, track intervals through the day, and review summaries in the Overview.

State is stored in `localStorage` by default. An optional Express + SQLite backend is available for persistence across devices.

## Running

Install dependencies:

```bash
npm install
```

Start the frontend dev server (port 5173):

```bash
npm run dev
```

To also persist data server-side, start the backend in a separate terminal:

```bash
node --experimental-strip-types server/index.ts
```

Then set `VITE_API_URL=http://localhost:3001` in `.env.local` to point the frontend at it.

## Tests

```bash
npm run test
```

---

[CLAUDE.md](CLAUDE.md) — architecture notes and instructions for AI-assisted development.
