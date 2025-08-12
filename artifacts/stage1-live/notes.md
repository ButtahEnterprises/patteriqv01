# Stage 1 – Live Pass/Fail Notes

Date: 2025-08-11
Mode: DEMO_MODE=false, USE_DB=true (cookie piq_demo_mode=false)

## API
- /api/health: PASS
  - ok=true, db.up=true, latencyMs≈35ms, skipped=false
- /api/data-health?weeks=4 (array): PASS
  - Future weeks excluded. Latest pctFullAllocated=100 (≥ 90% threshold).
- /api/data-health?weeks=12&includeIssues=1 (object): PASS
  - Response shape: { data: [...], issues: [...] }.
- /api/weeks: PASS
  - Weeks sorted desc by startDate; only weeks with startDate <= now present.

Artifacts: artifacts/stage1-live/api/*.json (+ pretty)

## UI
- Home page renders DataHealthCard (Live mode) without blocking; page loads successfully: PASS
- Screenshots saved:
  - artifacts/stage1-live/screens/home-1440x900.png
  - artifacts/stage1-live/screens/api-health.png
  - artifacts/stage1-live/screens/api-data-health-object.png

Notes:
- DB-gated tests can be run when ready with a test `DATABASE_URL`. Current artifacts confirm resilience behavior in Live.
