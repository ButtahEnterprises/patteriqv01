# Promotions API and UI

This document describes the `/api/promotions` endpoint, demo/live behavior, data format, the `PromotionCalendar` component contract, accessibility, and E2E testing notes.

## API: GET /api/promotions
- __Path__: `/api/promotions`
- __Query params__:
  - `years`: comma-separated list. Default: `2024,2025`.
  - `baselineWeeks`: integer window for baseline average, clamped `1..26`. Default: `4`.
- __Mode switching__:
  - Cookie `piq_demo_mode` (`true`/`false`) takes precedence.
  - If not set, falls back to `DEMO_MODE` and `USE_DB` environment config. When demo mode is on or DB disabled, the route returns demo-simulated metrics.
- __Response (array)__ of `PromotionApiItem`:
  - `id: string`
  - `name: string`
  - `description?: string`
  - `startDate: yyyy-mm-dd`
  - `endDate: yyyy-mm-dd`
  - `type?: string`
  - `tags?: string[]`
  - `skuUpcs?: string[]` (optional, demo files may include it)
  - `status?: "confirmed" | "tentative"`
  - `metrics: { baselineAvg: number; promoAvg: number; effectPct: number }`
    - `effectPct` is a percent, e.g. `12.3` means +12.3% vs baseline
  - `weeks: { isoWeek: string; revenue: number }[]` (for sparkline)

### Demo vs Live behavior
- __Demo__: reads JSON files under `data/promotions/` (e.g. `promotions_2024.json`, `promotions_2025.json`) and returns simulated metrics and weekly series.
- __Live__: computes metrics with Prisma:
  - Finds promo weeks and prior baseline window.
  - Optionally filters by `skuUpcs` if provided.
  - Group-by revenue for promo and baseline weeks.
  - Returns weekly revenue per ISO week and averages plus `effectPct`.

## UI: `src/components/PromotionCalendar.tsx`
- __Props__:
  - `items: PromoItem[]`
  - `demoMode: boolean`
  - `error?: string | null` (if set, renders explicit error panel)
- __Accessibility__:
  - Outermost card has `role="region"` and `aria-label="Promotion Calendar"`.
  - Error panel uses `role="alert"` and `aria-live="assertive"`.
  - Skeleton/empty state has `aria-live="polite"`.
- __Badges and formatting__:
  - Best/Worst badges computed client-side by `effectPct`.
  - Percentage formatting shows sign and one decimal (e.g. `-3.1%`).
- __Test IDs__:
  - `promotion-calendar`
  - `promotion-calendar-error`
  - `promo-card`
  - `promo-badge-best`
  - `promo-badge-worst`
  - `promo-effect`
  - `promo-sparkline`

## E2E Testing (Playwright)
- __Cookie handling__: Playwright 1.54 requires setting cookies with `url` only (no `path`).
  ```ts
  await context.addCookies([{ name: 'piq_demo_mode', value: 'true', url: baseURL }]);
  ```
- __Config__: `playwright.config.ts` reads `PLAYWRIGHT_BASE_URL`. The dev server is started with that port and `reuseExistingServer: true`.
- __Running__:
  - All E2E: `PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e`
  - Promotions only: `PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test tests/e2e/promotions.spec.ts`
- __Coverage__: `tests/e2e/promotions.spec.ts` validates:
  - Demo mode: calendar renders, at least one card, badges (when 2+), effect percent format, and sparkline visible.
  - Live mode: calendar renders with "Live" label, cards exist, effect format, badges when 2+.

## Data files
- Demo data stored in `data/promotions/`.
- Example keys: `id`, `name`, `description`, `startDate`, `endDate`, `type`, `tags`, `skuUpcs`, `status`.

## Importer: `scripts/import_promotions.ts`
- Purpose: parse business-supplied Excel calendars and (re)generate `promotions_2024.json` and `promotions_2025.json` under `data/promotions/`.
- Idempotent: deduplicates entries by `(startDate|endDate|normalized name)` signature to avoid duplicates across sheets.
- Year inference: when sheets don’t carry explicit years, the importer infers the year from the workbook filename (e.g. `...2025...` → `2025`).
- Fallback parsing (calendar style): if no tabular Start/End columns are found but the sheet has `MONTH` and `ULTA PROMOTION` columns, the importer will:
  - Extract one or more date ranges from the promo text like `m/d - m/d`.
  - Build `startDate`/`endDate` using the inferred year.
  - Add tags from the source (e.g. `ulta`) and preserve any existing tags.
  - Generate stable promo IDs and dedupe overlapping entries.
- Type normalization: the importer maps common titles to a standard `type` when an explicit type is not present in the sheet.
  - Examples: `"Fall Haul" → "Seasonal Sale"`, any title containing `BOGO` → `"BOGO"`, `"App Event" → "App Promotion"`.
  - Explicit `type` values in the source always take precedence and are preserved.
- Tag normalization: tags are canonicalized with synonym mapping.
  - `online`, `online only`, `dotcom`, `ecom`, `e-comm`, `ecomm`, `digital`, `digital only` → `digital`
  - `in store`, `instore`, `in-store`, `retail` → `in-store`
  - `app`, `app event`, `app-only`, `app only` → `app-event`
  - `mailer`, `magazine`, `catalog`, `catalogue` → `magazine`
  - If a promo explicitly says `online only`/`digital only`, any conflicting `in-store` tag is removed.
- Status detection: `status` is set based on placeholder language in names/descriptions.
  - Contains `TBD`, `TBC`, `TBA`, or `tentative` (case-insensitive) → `tentative`
  - Otherwise → `confirmed`
- Deduplication preference: when duplicates are found, the entry with richer metadata is kept.
  - Preference is based on having more `skuUpcs`, more `tags`, and longer `description`.
- Debug logging: pass `--debug` to emit detailed detection and parsing logs; without it, only summary lines are printed.

### Usage
```
# From repo root
npx tsx scripts/import_promotions.ts            # write JSONs with minimal logs
npx tsx scripts/import_promotions.ts --debug    # verbose parsing logs
```
Re-run the importer whenever the Excel calendars change. Commit the updated JSON files.

## Notes
- API returns only data; Best/Worst labels are determined by the `PromotionCalendar` client component.
- Baseline window can be tuned by `baselineWeeks`.
- Error handling: `src/app/page.tsx` fetches promotions separately and passes `error` to the component to render the alert.

## Real Promotion Calendars Integration
- Source calendars are read from `data/promotions/promotions_2024.json` and `data/promotions/promotions_2025.json`.
- Both Demo and Live modes use these same calendars for promo periods:
  - Demo mode simulates metrics/series but respects the exact date ranges from the calendar files.
  - Live mode computes metrics from the database for the same date ranges.
- These files must be the business-supplied, authoritative calendars (no stubs). Replacing these JSON files will update both modes immediately.

### Expected JSON shape
Each calendar entry is an object:
```json
{
  "id": "P25-SPRING",
  "name": "Spring Clean Skin",
  "description": "...",
  "startDate": "2025-03-31",
  "endDate": "2025-04-20",
  "type": "Category Focus",
  "tags": ["seasonal"],
  "skuUpcs": ["...optional UPCs..."],
  "status": "confirmed"
}
```

## Error-state E2E Coverage
- Tests live at `tests/e2e/promotions.spec.ts` and validate a11y/error behavior.
- The error-state tests intercept `GET /api/promotions` with a forced 500 and assert:
  - The `PromotionCalendar` renders an error panel with `data-testid="promotion-calendar-error"`.
  - The panel has `role="alert"` and includes a clear message ("Unable to load promotions").
- A test-only cookie `piq_test_error_promotions=true` is also supported by the API to inject a 500 for SSR fetches.

### Running E2E locally
```
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/promotions.spec.ts
```
Adjust the base URL/port to match your dev server.
