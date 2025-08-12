# Dev Notes: E2E in CI and Local

## Known Green Baseline — 2025-08-10

- __Tag__: `ci-green-20250810` (to be pushed after CI run is fully green)
- __Suite__: Typecheck, lint, build, unit/API tests, and E2E matrix (`leaderboards`, `promotions`, `drilldown`) passed in CI.
- __Wait strategy__: Navigate with `waitUntil: 'domcontentloaded'` and use explicit selector waits. Avoid `networkidle` because Next.js dev/HMR keeps long‑lived connections (WS/event streams) that can prevent a true idle state and cause flakiness.
- __Artifacts hygiene__: CI now runs a secret scan over Playwright artifacts on both success and failure; no warnings observed in the green run.

### Reproduce Locally (fast path)

```bash
# 1) Install Playwright browsers once
npm run playwright:install

# 2) Typecheck, lint, unit/API tests
npx tsc --noEmit
npm run lint
npm test

# 3) Build and start in Demo mode on 3007 (no DB required)
npm run build
npm run start:demo

# 4) In another shell, run E2E against the external server
npm run e2e:local
```

### CI Reproduction

- Workflow: `.github/workflows/ci.yml` (triggers on `push` and `pull_request`).
- Jobs:
  - __quality-checks__: typecheck, lint, unit/API tests, build, start server, data-health gate.
  - __E2E (matrix)__: runs each spec separately against the same server.
- Env for E2E: `PLAYWRIGHT_BASE_URL=http://localhost:3000`, `PLAYWRIGHT_NO_SERVER=1`.
- Artifacts on failure: HTML report and traces are uploaded; secret scan runs on failure and success.

### Quick Scripts

- `start:demo`: `DEMO_MODE=true USE_DB=false PORT=3007 npm run start`
- `e2e:local`: `PLAYWRIGHT_BASE_URL=http://localhost:3007 PLAYWRIGHT_NO_SERVER=1 npx playwright test`

## Overview
- E2E specs live in `tests/e2e/` and are split into three specs:
  - `leaderboards.spec.ts`
  - `promotions.spec.ts`
  - `drilldown.spec.ts`
  - `weekly-facts.spec.ts`
- Playwright config: `playwright.config.ts`
  - Reporter: HTML report in `./playwright-report`
  - Trace: `retain-on-failure` stored under `./test-results`
  - Screenshots/Videos retained on failure

## CI Setup
- Workflow: `.github/workflows/ci.yml`
  - Job `quality-checks`: typecheck, lint, unit/api tests, build, start Next.js, and run a data-health gate.
  - Job `e2e` (matrix): runs each spec in parallel against the same pattern (build → start server → run a single spec).
  - Environment for E2E:
    - `PLAYWRIGHT_BASE_URL=http://localhost:3000`
    - `PLAYWRIGHT_NO_SERVER=1` (external server started by the workflow)
  - On failure, CI uploads artifacts:
    - HTML report: `playwright-report-<spec>` (from `./playwright-report`)
    - Traces: `playwright-traces-<spec>` (from `./test-results`)

### Accessing CI Artifacts
1. Open the failed GitHub Actions run.
2. Open the failed `E2E (<spec>)` job.
3. Download artifacts:
   - `playwright-report-<spec>` → unzip and open `index.html` in a browser.
   - `playwright-traces-<spec>` → unzip; each `*.zip` is a Playwright trace.
4. View a trace locally:
   ```bash
   npx playwright show-trace path/to/trace.zip
   ```

## Local E2E Running
1. Install browsers once:
   ```bash
   npx playwright install
   ```
2. Start the dev server (project typically uses 3007 locally):
   ```bash
   PORT=3007 npm run dev
   ```
3. Run all specs against the external server:
   ```bash
   PLAYWRIGHT_BASE_URL=http://localhost:3007 PLAYWRIGHT_NO_SERVER=1 npx playwright test
   ```
4. Run a single spec (example):
   ```bash
   PLAYWRIGHT_BASE_URL=http://localhost:3007 PLAYWRIGHT_NO_SERVER=1 npx playwright test tests/e2e/leaderboards.spec.ts
   ```

## Notes on Stability
- Tests use explicit waits: navigate with `waitUntil: 'domcontentloaded'` and then wait for specific selectors (e.g., `await page.waitForSelector('[data-testid="..."]')`) before interacting. Avoid `networkidle` due to long-lived connections in Next.js.
- Dashboard cards (`KpiTrendChart`, `DataHealthCard`, `StoresAtRiskList`) are server-fed; skeletons may not be visible in production builds due to SSR providing data at render time. Tests validate readiness via `aria-busy="false"` and presence of either a populated table or an explicit empty state.
- Demo/Live toggling via cookie `piq_demo_mode` is handled in tests by adding a cookie to the Playwright context (no path, only `url`).

### Weekly Sales — Facts E2E

- Spec: `tests/e2e/weekly-facts.spec.ts`
- Coverage:
  - Demo mode: verifies Demo badge and empty state (`data-testid="facts-empty"`).
  - Live mode: programmatically ingests XLSX fixtures via `/api/ingest/ulta`, verifies rows render, revenue sort, and allocator behavior (UPC presence/absence).
  - Cross-mode toggle: flips `piq_demo_mode` cookie in the same session and verifies panel updates.
- Selector strategy uses explicit `data-testid` attributes in `src/components/WeeklyFactsTable.tsx`: `weekly-facts`, `facts-badge` (with `data-mode`), `facts-empty`, `facts-row`, `store-code`, `upc`, `revenue`.
- Week anchoring: tests navigate with an explicit `?week=YYYY-MM-DD` to ensure the dashboard fetches the ingested week, matching server-side fetching in `src/app/page.tsx`.
- DB preflight: the spec calls `/api/health` and skips Live ingestion tests if the database is unavailable. Demo test still runs.

Run locally (Demo only):
```bash
# Start in demo mode on 3007
npm run build && npm run start:demo

# Run only the Weekly Facts spec against external server
PLAYWRIGHT_BASE_URL=http://localhost:3007 PLAYWRIGHT_NO_SERVER=1 npx playwright test tests/e2e/weekly-facts.spec.ts
```

Run locally (with DB):
```bash
# Ensure DATABASE_URL is set and DB is up
PORT=3000 npm run dev

# Run the spec (webServer auto-starts if needed)
npx playwright test tests/e2e/weekly-facts.spec.ts
```

## Troubleshooting & Recovery (CI E2E)

- If E2E fails in CI, download artifacts from the failed `E2E (<spec>)` job:
  - HTML report: unzip `playwright-report-<spec>` and open `index.html`.
  - Traces: unzip `playwright-traces-<spec>` and open with:
    ```bash
    npx playwright show-trace path/to/trace.zip
    ```
- Typical fixes:
  - Ensure robust waits: navigate with `{ waitUntil: 'domcontentloaded' }` and use selector-based waits like `await page.waitForSelector('<selector>')` before interacting. Avoid `networkidle`.
  - Verify `data-testid` or ARIA selectors exist in component code.
  - For Demo/Live parity, set cookie: `piq_demo_mode=true|false` on the Playwright context; do not include `path`.
  - Validate server is up in CI by checking `/tmp/next.log` from the job logs.

## Artifact Privacy Checklist

- Playwright traces may include network URLs and response bodies from local server; our app does not include secrets in headers.
- CI runs upload artifacts only on failure. The workflow performs a simple scan on HTML reports for secret-like strings.
- Before sharing artifacts externally, manually review for:
  - Keys/tokens, `Authorization` headers, `DATABASE_URL`, or any `.env` content.
  - PII in screenshots (none expected in demo).

## Lighthouse & Accessibility

Run locally (requires Chrome):

```bash
# Start server on 3007
PORT=3007 npm run dev

# Lighthouse (desktop preset)
npx lighthouse http://localhost:3007 --preset=desktop --only-categories=performance,accessibility,best-practices,seo --output html --output-path ./lighthouse-report.html

# Optional: quick a11y with axe
npx @axe-core/cli http://localhost:3007 --exit 0 || true
```

Manual a11y checklist:
- Each dashboard card has role (region/figure) and descriptive label.
- Loading states use `aria-busy`.
- Error states expose ARIA alert or clear text.
- Focus outlines visible; keyboard navigation reaches interactive rows (e.g., `StoresAtRiskList`).

## TypeScript Typings & Accessibility Cleanup (2025-08-10)

### Summary
- Restricted `tsconfig.json` `compilerOptions.types` to only: `node`, `react`, `react-dom`, `supertest` to avoid stray `@types/*` folders (e.g., `d3-array 2`) causing TS2688.
- Resolved Prisma `groupBy` typings in `scripts/ulta_ingest.ts` by:
  - Using `as const` for `by` arrays and letting return types be inferred (no explicit array type annotation on results).
  - Adding `orderBy` where useful and validating args with `satisfies Prisma.SalesFactGroupByArgs`.
- Removed unsafe `any` in ingestion/parsers. Replaced with `unknown` and precise aliases; added guards where needed.
- Fixed Next.js App Router page params in `src/app/store/[storeId]/page.tsx`:
  - Accept `{ params: Promise<{ storeId: string }> }` and `await params` (Next.js 15 generated PageProps expects `Promise`).
- Ensured accessibility on error pages:
  - `src/app/error.tsx` and `src/app/not-found.tsx` use Next.js `Link` (no raw `<a>`), have clear headings, and work in dark theme.

### Verification
- Type check: `npx tsc --noEmit` (clean)
- Lint: `npm run lint` (no warnings)
- Build: `npm run build` (clean)
- Unit/API tests: `npm test` (all pass)
- Optional: Lighthouse/axe on 404 page (`/non-existent`) for a11y score checks

### Notes
- If Prisma `groupBy` generics complain, avoid over-annotating result arrays; prefer inference and validate args via `satisfies`.
- If Next.js types change again, re-open `.next/types/.../page.ts` to see the expected `PageProps` shape.

### Addendum: d3/* and cookiejar typings
- Confirmed no direct `d3/*` or `cookiejar` deps in `package.json`. The TS2688 errors came from duplicate stray folders like `node_modules/@types/d3-array 2/` and `node_modules/@types/cookiejar 2/` picked up by the compiler.
- Resolution:
  - Restricted `tsconfig.json` `compilerOptions.types` to an allowlist so stray `@types/*` are ignored.
  - Optional cleanup (local dev only): remove the stray `" 2"` folders under `node_modules/@types` and re-install deps to prevent editor noise.
- Ambient declarations were not needed; no `any`-based shims were introduced.

### Accessibility scan instructions
- Lighthouse (Chrome): open any error page (e.g. `/non-existent`), run Lighthouse → Accessibility. Expect high 90s/100 with headings/links labeled and focus indicators visible.
- axe DevTools: run quick scan on `src/app/error.tsx` and `src/app/not-found.tsx` rendered pages; verify no critical violations. Pay attention to link names, region roles, and color contrast in dark theme.
