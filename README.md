# CompetitorPulse

Tracks competitor product listings over time and uses an LLM to explain, in plain English, what
changed between two consecutive snapshots.

- **Backend:** Node.js 24 + TypeScript, Fastify, PostgreSQL (Drizzle ORM, committed SQL
  migrations), Zod, pino.
- **Frontend:** React 19 + Vite, React Router, TanStack Query, CSS Modules.
- **LLM:** the provided **mock LLM server** by default. Any OpenAI Chat Completions compatible
  provider works through env vars (see [LLM configuration](#llm-configuration)).
- **Tests:** Vitest (unit + integration against real Postgres via Testcontainers), Testing Library,
  Playwright (e2e).

## Quick start (Docker)

Requires Docker.

```bash
docker compose up --build
```

| URL                       | What                                               |
| ------------------------- | -------------------------------------------------- |
| http://localhost:8080     | Web UI (nginx serves the SPA, proxies `/api`)      |
| http://localhost:3000/api | API directly                                       |
| http://localhost:4001     | Mock LLM (`/control/stats`, `/control/configure`)  |
| `localhost:5434`          | Postgres (`competitor_pulse` / `competitor_pulse`) |

Compose starts Postgres, the mock LLM, the API (which applies migrations on startup) and the web
app. The poll interval defaults to **30s** so changes show up quickly in a demo. Override it with
`POLL_INTERVAL_MS=5000 docker compose up`. The fixtures hold 4 versions per competitor, so after
about 3 polls the listing stops changing.

Try it: track `acme-crm`, `north-analytics` or `ferry-pay`, then open the competitor to watch its
timeline fill in. The timeline refreshes on its own every 5 seconds.

## Local development

Requires Node.js 24+ and pnpm 11 (`npm i -g pnpm@11`).

```bash
pnpm install
cp .env.example .env                 # points at the compose Postgres on :5434
docker compose up -d db mock-llm     # infrastructure only
pnpm db:migrate
pnpm dev                             # API on :3000, web on http://localhost:5173 (proxies /api)
```

| Script            | What it does                                                               |
| ----------------- | -------------------------------------------------------------------------- |
| `pnpm dev`        | API (tsx watch) and web (Vite) in parallel                                 |
| `pnpm build`      | Builds contract, server and web                                            |
| `pnpm test`       | Unit + integration + component tests (needs Docker for Testcontainers)     |
| `pnpm test:e2e`   | Playwright against a running stack (`docker compose up -d --build --wait`) |
| `pnpm lint`       | ESLint (type-aware, strict) + Prettier check                               |
| `pnpm typecheck`  | `tsc --noEmit` in every package                                            |
| `pnpm db:migrate` | Applies SQL migrations from `apps/server/drizzle`                          |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build, then the Playwright e2e test
against the docker compose stack.

## LLM configuration

By default the server talks to the bundled mock (`files/mock-llm/mock-llm-server.py`). It echoes the
prompt back instead of summarizing, which proves the real context reaches it. The client uses the
OpenAI Chat Completions shape over native `fetch`, so switching providers is configuration only:

```bash
# OpenAI
LLM_BASE_URL=https://api.openai.com/v1 LLM_API_KEY=sk-... LLM_MODEL=gpt-4o-mini docker compose up
# Ollama
LLM_BASE_URL=http://host.docker.internal:11434/v1 LLM_MODEL=llama3.1 docker compose up
```

The mock's control endpoints make the resilience behaviour easy to demo:

```bash
curl localhost:4001/control/stats                                   # call count: does not grow for unchanged polls
curl -XPOST localhost:4001/control/configure -d '{"failNext": 2}'   # 500s, then retried with backoff
curl -XPOST localhost:4001/control/configure -d '{"latencyMs": 20000}' # exceeds LLM_TIMEOUT_MS (15s)
curl -XPOST localhost:4001/control/reset
```

All other settings are listed in [`.env.example`](.env.example) and validated with Zod at startup.

## API

The required contract is implemented as specified. Every error uses one shape:
`{ "error": { "code": "...", "message": "..." } }`.

| Method & path                        | Success                       | Errors                                                                    |
| ------------------------------------ | ----------------------------- | ------------------------------------------------------------------------- |
| `GET /api/competitors`               | `200 [{ id }]`                |                                                                           |
| `POST /api/competitors` `{ id }`     | `201 { id }`                  | `400` invalid id, `409` already tracked, `422` unknown to the data source |
| `DELETE /api/competitors/:id`        | `204`                         | `404` not tracked                                                         |
| `GET /api/competitors/:id/snapshots` | `200 [Snapshot]` newest first | `400` bad query, `404` not tracked                                        |
| `GET /api/health`                    | `200`                         |                                                                           |

`Snapshot` carries the required fields (`fetchedAt`, `title`, `tagline`, `price`, `description`,
`changed`, `summary`) plus three additive ones:

- `id`
- `summaryStatus`: `none | pending | ready | failed`, so the UI can tell "still generating" apart
  from "failed"
- `changes`: the deterministic field diff `[{ field, before, after }]`

Snapshots are paginated with optional `?limit=` (default 100, max 500) and `?before=<fetchedAt>`
(keyset cursor).

The request/response Zod schemas live in `packages/contract` and are shared by server and web.

## Architecture

```
apps/server/src
  competitors/      routes -> CompetitorService -> repository
  snapshots/        diff.ts (pure), SnapshotPoller, repository, routes
  summaries/        SummaryWorker, OpenAiSummarizer (behind ChangeSummarizer), prompt
  listing-source/   ListingSource interface + in-process fixture stub
  db/               Drizzle schema, client, migrate
  shared/           clock, interval loop, bounded concurrency, validation
apps/web/src
  features/competitors   list page, add form, optimistic mutations
  features/timeline      timeline page, snapshot card, infinite query
packages/contract        Zod schemas + types shared by both sides
```

External dependencies (listing source, LLM, clock) are interfaces injected at the composition root
(`main.ts`). Tests swap them for fakes.

### How a poll flows

1. **Scheduler tick** (every `POLL_INTERVAL_MS`). The tick takes a Postgres advisory lock, so
   overlapping ticks or several API instances never poll twice. The next tick is scheduled only
   after the current one finishes.
2. Each tracked competitor is fetched with bounded concurrency (`POLL_CONCURRENCY`). One failing
   competitor is logged and does not stop the others.
3. **In one short transaction per competitor**: lock the competitor row, read the latest snapshot,
   compute the **deterministic field diff** in pure code, and insert the new snapshot. Every fetch is
   stored, changed or not. If something changed, the snapshot is marked `summaryStatus = 'pending'`.
4. **The LLM is never called inside that transaction.** A separate `SummaryWorker` loop claims due
   pending rows. It uses `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` and pushes
   `summary_next_attempt_at` forward as a lease. It then calls the LLM with the previous snapshot,
   the new snapshot and the diff, and stores the summary.
5. **On failure or timeout** (`AbortSignal.timeout`), the job is rescheduled with exponential
   backoff. After `SUMMARY_MAX_ATTEMPTS` it is marked `failed`, and the UI falls back to the
   deterministic diff. If the worker crashes mid-call, the lease expires and another worker picks
   the job up.

So a slow or failing LLM can never lose, corrupt or delay a snapshot. Retries survive restarts
because their state lives in the database, not in memory.

Tracking a competitor also triggers an immediate first poll, so the timeline is not empty until the
next tick.

### Data model

- `competitors(id text PK CHECK slug, created_at)`
- `snapshots`
  - ids: `id uuid PK`, `competitor_id FK ON DELETE CASCADE`, `previous_snapshot_id FK`
  - listing: `fetched_at timestamptz`, `title`, `tagline`, `price`, `description`
  - diff: `changed`, `changes jsonb`
  - summary job: `summary`, `summary_status enum`, `summary_attempts`, `summary_next_attempt_at`,
    `summary_error`
- Indexes
  - `(competitor_id, fetched_at DESC)` serves both the timeline and "latest snapshot" lookups.
  - A partial index on `summary_next_attempt_at WHERE summary_status = 'pending'` keeps the work
    queue scan tiny however large history grows.

### At production scale (hundreds of competitors, every 15 minutes, paid LLM calls)

- **LLM cost is proportional to changes, not polls.** Unchanged fetches never reach the LLM. The
  mock's `/control/stats` makes this visible.
- A tick is a few hundred short transactions with bounded concurrency. Polling does not wait on the
  LLM.
- The advisory lock and `SKIP LOCKED` make it safe to run several API replicas without double
  polling or double billing.
- A flood of changes is absorbed by the queue, not by the request path.

## Key decisions and trade-offs

- **Postgres as the job queue** instead of Redis/BullMQ. It is one less moving part, and job state
  commits atomically with the snapshot. At much higher volume I would move to a dedicated queue.
- **A deterministic diff decides "changed"; the LLM only explains it.** This keeps `changed` exact,
  testable and free, and the LLM prompt is grounded in the diff.
- **`summary` stays `null` unless it is ready**, as the contract says. The extra `summaryStatus` and
  `changes` fields let the UI show "generating…" or a diff fallback without breaking the contract.
- **Price is stored as the raw string.** The fixtures contain `"$0 - $199/mo"` and
  `"2.9% + $0.30 per transaction"`, which have no faithful single-number representation, and the
  contract returns a string.
- **No retries inside the HTTP client.** Retry and backoff are owned by the worker, so they are
  persistent and never block anything.
- **Typed errors**: `AppError` subclasses map to one error shape in a single Fastify error handler.

## Assumptions

- The **first snapshot** of a competitor has nothing to compare against, so it is `changed: false`
  ("no change"), matching the example screenshot.
- **Ids are normalized** (trim, lowercase) and must be slugs. Ids the data source does not know
  return `422`, to catch typos instead of tracking something that can never be fetched.
- The **stub's per-competitor cursor lives in memory**, because it simulates an external site. A
  server restart therefore replays versions 1–4, which shows up as new changes against the stored
  history. Removing and re-adding a competitor deletes its history but does not rewind the stub.
- Removing a competitor deletes its snapshots (cascade). The UI asks for confirmation first.
- All timestamps are stored and sent as UTC ISO 8601. The browser formats them in the viewer's
  locale and time zone.

## Scope cuts (about 3 hours)

- **No cloud deployment.** The images are production-shaped (multi-stage build, non-root user,
  migrations on start, healthcheck). Next step: push to a registry and run on e.g. Fly.io / Cloud
  Run with managed Postgres, with migrations as a release step.
- **Few component tests and no MSW.** Component tests cover the snapshot states and optimistic
  add/rollback with a stubbed `fetch`. Most coverage is in the server integration tests and one
  Playwright flow.
- **Remove uses a confirmation dialog** rather than undo.

## What I would do next

- Run the scheduler and summary worker as separate processes from the API, and add metrics: poll
  duration, queue depth, LLM latency/cost, failure rate.
- Content hashing and conditional fetches (ETag) against real sources, and per-competitor poll
  intervals.
- Structured JSON output from a real LLM (with a Zod-validated schema) once a real provider is
  configured. The mock only returns free text.
- Persist the source cursor if the stub ever needs to survive restarts, and add OpenAPI docs
  generated from the shared Zod schemas.

## AI tools used

Built with **Claude Code** (Claude Opus) as a pair programmer: scaffolding, implementation, tests and
this README. Behaviour was verified end-to-end against the docker compose stack, including the mock
LLM's failure and latency modes.
