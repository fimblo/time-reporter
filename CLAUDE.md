# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start            # Start backend + frontend together (concurrently)
npm run start:demo   # Same, but uses data/demo.sqlite
npm run seed:demo    # Populate data/demo.sqlite with 3 fictional clients (~4 weeks of data)
npm run dev          # Frontend dev server only (Vite, port 5173 with proxy to :3001)
npm run test         # Run tests once (Vitest)
```

Run a single test file:
```bash
npx vitest run src/lib/timeUtils.test.ts
```

Start backend alone (if not using `npm start`):
```bash
node --experimental-strip-types server/index.ts
```

The `TIME_REPORTER_DB` environment variable controls which SQLite file the backend uses.
Defaults to `data/time-reporter.sqlite`.

## Architecture

This is a React + TypeScript SPA built with Vite, backed by an Express + SQLite server.

**Frontend state flow:**
- `App.tsx` owns `AppState` (tasks + lastActiveTaskId)
- `useTimerEngine` (`src/hooks/useTimerEngine.ts`) manages timer state: a 1-second tick updates `now`, and `startTimer`/`pauseTimer` mutate intervals on tasks. Every state change calls the `onChange` callback (i.e. `saveState`) synchronously.
- `App.tsx` computes derived data (`buildDailySummary`, totals) with `useMemo` and passes it down to views.

**Core data model** (`src/types.ts`):
- `Client` has `id`, `name`, `color`, and `visibleInTabs`. Tasks belong to a client by name.
- `Task` contains `intervals: Interval[]` (start/end ISO timestamps) and optional `overrides: DailyOverride[]`.
- A `DailyOverride` has a `minutesOverride` value and an optional `setAt` ISO timestamp. When `setAt` is present, the override is a *base*: intervals starting after `setAt` add on top. Legacy overrides (no `setAt`) replace all interval minutes for that day.
- An `Interval` with `end === null` is the currently running interval (only one allowed across all tasks).

**`buildDailySummary`** (`src/lib/timeUtils.ts`) aggregates intervals by calendar day in local time, then applies overrides. This is the canonical source of truth for reported minutes.

**Storage:**
- Backend (`server/`): SQLite via `better-sqlite3`. Schema has `clients`, `tasks`, `intervals`, `daily_overrides`, and `meta` tables. The server exposes `GET /api/state`, `PUT /api/state`, `GET /api/clients`, `POST /api/clients`, and `PUT /api/clients/:id`.
- Frontend proxies `/api/*` to `http://localhost:3001` via the Vite dev server — no `.env.local` needed. `VITE_API_URL` can override this for non-proxy deployments.

**Tests:** Vitest with jsdom for frontend, Node environment for backend. Test files colocated as `*.test.ts(x)`. `server/db.test.ts` covers the database layer; `src/lib/` tests cover time calculations and CSV export.

## Commit style

Conventional Commits: `type: short description` — lowercase, no trailing period.
Common types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`.
Commit subject length: no more than 60 characters.
