# Stage 1 – Demo Pass/Fail Notes

Date: 2025-08-11
Mode: DEMO_MODE=true, USE_DB=false (cookie piq_demo_mode=true)

## API
- /api/health: PASS
  - ok=true, db.skipped=true, useDb=false
- /api/data-health?weeks=4 (array): PASS
  - Future weeks excluded. Response shape: array of { isoWeek, totalStores, pseudoStores, pctFullAllocated }.
- /api/data-health?weeks=4&includeIssues=1 (object): PASS
  - Response shape: { data: [...], issues: [...] }. Backward-compatible array when not requested.
- /api/stores-at-risk?lookback=8&limit=10: PASS
  - Demo list returned <= 10 rows.
- /api/weekly-summary: PASS
- /api/kpi/trend?weeks=12: PASS
- /api/promotions?years=2024,2025: PASS
- /api/promo-attribution?years=2024,2025&baselineWeeks=4: PASS

Artifacts: artifacts/stage1-demo/api/*.json (+ pretty)

## UI
- Home page renders non-blocking DataHealthCard with issues callout space when issues present: PASS
- Screenshots saved:
  - artifacts/stage1-demo/screens/home-1440x900.png
  - artifacts/stage1-demo/screens/home-mobile-390x844.png
  - artifacts/stage1-demo/screens/examples-1440x900.png
  - artifacts/stage1-demo/screens/api-health.png
  - artifacts/stage1-demo/screens/api-data-health-object.png

Notes:
- Tests (no DB): all non-DB tests passed; DB-gated tests skipped (no DATABASE_URL).
