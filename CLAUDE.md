# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start frontend dev server (Vite, port 5173 with proxy to :3001)
npm run build        # Type-check + build frontend
npm run lint         # ESLint
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

Run a single test file:
```bash
npx vitest run src/lib/timeUtils.test.ts
```

The backend server is a separate process (not managed by Vite scripts):
```bash
node --experimental-strip-types server/index.ts   # or tsx/ts-node
```

## Architecture

This is a React + TypeScript SPA built with Vite. All state is persisted to `localStorage` by default, with an optional Express + SQLite backend.

**Frontend state flow:**
- `App.tsx` owns `AppState` (tasks + lastActiveTaskId)
- `useTimerEngine` (`src/hooks/useTimerEngine.ts`) manages timer state: a 1-second tick updates `now`, and `startTimer`/`pauseTimer` mutate intervals on tasks. Every state change calls the `onChange` callback (i.e. `saveState`) synchronously.
- `App.tsx` computes derived data (`buildDailySummary`, totals) with `useMemo` and passes it down to views.

**Views:**
- `TrackingView` — lists tasks, shows live elapsed time per task, allows create/edit/delete/start/pause.
- `OverviewView` — shows the daily summary table grouped by date.

**Core data model** (`src/types.ts`):
- `Task` contains `intervals: Interval[]` (start/end ISO timestamps) and optional `overrides: DailyOverride[]`.
- A `DailyOverride` for a given `(taskId, date)` replaces the computed interval minutes for that day with a fixed value.
- An `Interval` with `end === null` is the currently running interval (only one allowed across all tasks).

**`buildDailySummary`** (`src/lib/timeUtils.ts`) aggregates intervals by calendar day in local time, then applies overrides. This is the canonical source of truth for reported minutes.

**Storage:**
- Frontend: `localStorage` key `time-reporter-state-v1`, full `AppState` JSON.
- Backend (`server/`): SQLite via `better-sqlite3`. Schema has `tasks`, `intervals`, `daily_overrides`, and `meta` tables. The server exposes `GET /api/state` and `PUT /api/state`; the frontend uses `VITE_API_URL` env var to optionally point at it instead of localStorage.

**Tests:** Vitest with jsdom. Test files colocated as `*.test.ts(x)`. Setup file imports `@testing-library/jest-dom/vitest`.

## Commit style

Conventional Commits: `type: short description` — lowercase, no trailing period.
Common types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`.
Commit subject length: no more than 60 characters.

