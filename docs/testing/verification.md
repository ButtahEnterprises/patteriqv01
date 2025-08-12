# PatternIQ Resilience Testing – Demo Artifacts and Verification

This document captures Stage 1 (Demo) verification artifacts and how to reproduce them. It supports the comprehensive plan to validate resilience features: future-week filtering, tolerant ingestion, and non-blocking UI warnings.

## Environment
- Demo server: port 3007
- Mode: DEMO_MODE=true, USE_DB=false
- Build: `npm run build`
- Start (if needed): `npm run start:demo`
- Tests (no DB): `USE_DB=false DATABASE_URL= npm test`

## API Snapshots (Demo)
Saved under `artifacts/stage1-demo/api/`:
- health.json, health.pretty.json
- data-health-weeks4.json, data-health-weeks4.pretty.json
- data-health-weeks4.object.json, data-health-weeks4.object.pretty.json
- stores-at-risk.json, stores-at-risk.pretty.json
- weekly-summary.json, weekly-summary.pretty.json
- kpi-trend-weeks12.json, kpi-trend-weeks12.pretty.json
- promotions.json, promotions.pretty.json
- promo-attribution.json, promo-attribution.pretty.json

These were produced with:
```bash
# Health
curl -s http://localhost:3007/api/health | jq .

# Data health (array)
curl -s -H "Cookie: piq_demo_mode=true" \
  "http://localhost:3007/api/data-health?weeks=4" | jq .

# Data health (object w/ issues)
curl -s -H "Cookie: piq_demo_mode=true" \
  "http://localhost:3007/api/data-health?weeks=4&includeIssues=1" | jq .

# Stores at risk (demo)
curl -s -H "Cookie: piq_demo_mode=true" \
  "http://localhost:3007/api/stores-at-risk?lookback=8&limit=10" | jq .

# Weekly summary (demo)
curl -s -H "Cookie: piq_demo_mode=true" \
  "http://localhost:3007/api/weekly-summary" | jq .

# KPI trend (demo)
curl -s -H "Cookie: piq_demo_mode=true" \
  "http://localhost:3007/api/kpi/trend?weeks=12" | jq .

# Promotions (demo)
curl -s -H "Cookie: piq_demo_mode=true" \
  "http://localhost:3007/api/promotions?years=2024,2025" | jq .

# Promo attribution (demo)
curl -s -H "Cookie: piq_demo_mode=true" \
  "http://localhost:3007/api/promo-attribution?years=2024,2025&baselineWeeks=4" | jq .
```

## What to Verify (Demo)
- /api/data-health excludes future weeks; array is ascending by `isoWeek` and >= 8 when non-empty.
- /api/data-health object form includes `data` and `issues` arrays (backward compatible array by default).
- /api/stores-at-risk returns <= 10 items with `{ storeId, storeName, zScore:number, pctChange:number }` in demo.
- /api/health reports `{ ok: true, db: { skipped: true } }` when `USE_DB=false`.

## Test Results (No DB)
- Command: `USE_DB=false DATABASE_URL= npm test`
- Result: All non-DB tests passed; DB-gated tests skipped without `DATABASE_URL`.
- Notes:
  - `tests/components/dataHealthCard.issues.test.ts` accounts for React SSR comment-wrapped numbers.
  - `tests/smoke.test.ts` health check is conditional when DB is skipped.

## Next Steps
- Live DB validation: set `DATABASE_URL` to a test DB, run `USE_DB=true npm test` to enable DB-gated tests (`/api/weeks` future-week filtering, tolerant ULTA ingestion warnings, store trend/sku breakdown).
- Capture Live artifacts under `artifacts/stage1-live/` using analogous curl commands with `Cookie: piq_demo_mode=false`.

## Screenshots
- Demo (`artifacts/stage1-demo/screens/`):
  - `home-1440x900.png`, `home-mobile-390x844.png`
  - `examples-1440x900.png`
  - `api-health.png`, `api-data-health-object.png`
- Live (`artifacts/stage1-live/screens/`):
  - `home-1440x900.png`
  - `api-health.png`, `api-data-health-object.png`

## API Snapshots (Live)
Saved under `artifacts/stage1-live/api/`:
- `health.json`, `health.pretty.json`
- `data-health-weeks4.json`, `data-health-weeks4.pretty.json`
- `data-health-weeks12.object.json`, `data-health-weeks12.object.pretty.json`
- `weeks.json`, `weeks.pretty.json`

Observed:
- `/api/data-health?weeks=4` latest `pctFullAllocated` = `100` (passes ≥ 90% threshold).
- `/api/weeks` excludes future weeks (server-side filter `startDate <= now`).

Notes:
- Live artifacts were captured with the same curl patterns as Demo, but with `Cookie: piq_demo_mode=false`.

## Stage 2 (DB) – Verification Artifacts

Environment:
- USE_DB=true
- DEMO_MODE=false
- DATABASE_URL=postgresql://postgres:postgres@localhost:54329/patterniq_test?schema=public
- Port: 3006

How to reproduce locally:
```bash
# Ensure Docker Postgres is running and schema is in sync
USE_DB=true DATABASE_URL="postgresql://postgres:postgres@localhost:54329/patterniq_test?schema=public" npx prisma db push

# Build and start server
npm run build
USE_DB=true DEMO_MODE=false DATABASE_URL="postgresql://postgres:postgres@localhost:54329/patterniq_test?schema=public" PORT=3006 npm run start
```

API Snapshots (DB): saved under `artifacts/stage2-db/api/`
- `health.json`, `health.pretty.json`
- `weeks.json`, `weeks.pretty.json`
- `data-health-weeks4.json`, `data-health-weeks4.pretty.json`
- `data-health-weeks12.object.json`, `data-health-weeks12.object.pretty.json`

Test Results (DB):
- Command: `USE_DB=true DATABASE_URL=... npm test`
- Result: All DB-gated tests passed (13 files, 52 tests)
- Output: `artifacts/stage2-db/vitest-output-2.txt`

Notes:
- `/api/weeks` verified to exclude future weeks from DB results.
- Server logs: `artifacts/stage2-db/server.log`
