import { test, expect } from '@playwright/test';
import type { Page, APIResponse } from '@playwright/test';
import * as XLSX from 'xlsx';

function baseURL() {
  return test.info().project.use.baseURL || 'http://localhost:3000';
}

async function setDemoCookie(page: Page, value: boolean) {
  await page.context().addCookies([{ name: 'piq_demo_mode', value: String(value), url: baseURL() }]);
}

// Test-only cleanup for a given week and optional stores
async function cleanupWeekFacts(page: Page, weekEndStr: string, storeCodes?: string[]) {
  const res = await page.request.post(baseURL() + '/api/test/cleanup', {
    headers: {
      'x-test-secret': process.env.TEST_API_SECRET || 'dev-secret',
      Cookie: 'piq_demo_mode=false',
    },
    data: { week: weekEndStr, storeCodes },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
}

function makeStoreSalesXlsx(rows: Array<{ storeCode: string; storeName: string; units: number; revenue: number }>): Buffer {
  const aoa: any[][] = [];
  aoa.push(['ULTRA REPORT']);
  aoa.push(['Generated', new Date().toISOString()]);
  aoa.push(['Store Number', 'Store Name', 'Sales Units', 'Net Sales']);
  for (const r of rows) aoa.push([r.storeCode, r.storeName, r.units, r.revenue]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'StoreSalesReport');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as any);
}

async function ensureDbOrSkip(page: Page) {
  const res = await page.request.get(baseURL() + '/api/health', {
    headers: { Cookie: 'piq_demo_mode=false' },
  });
  const json = await res.json();
  const useDb = !!json?.mode?.useDb;
  const dbUp = !!json?.db?.up && !json?.db?.skipped;
  if (!useDb || !dbUp) {
    test.skip(true, 'Database not available. Skipping Live promo overlay tests.');
  }
}

async function ingestStoreTotals(page: Page, weekEndStr: string, storeRows: Array<{ storeCode: string; storeName: string; units: number; revenue: number }>) {
  const storeBuf = makeStoreSalesXlsx(storeRows);
  const res: APIResponse = await page.request.post(baseURL() + '/api/ingest/ulta', {
    headers: { Cookie: 'piq_demo_mode=false' },
    multipart: {
      weekEndDate: weekEndStr,
      file: { name: 'Store-Sales_ABC.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: storeBuf },
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
}

function getTrendMarkerCountLocator(page: Page) {
  return page.getByTestId('kpi-trend-chart');
}

function getFactsPanel(page: Page) {
  return page.getByTestId('weekly-facts');
}

// Demo mode: verify promo toggle changes trend marker count
// Pick a week that intersects demo promotions (e.g., 2025-08-17, which overlaps multiple demo events)
test('Promo overlay (Demo) toggles trend markers', async ({ page }) => {
  await setDemoCookie(page, true);
  await page.goto('/?week=2025-08-17');

  const chart = getTrendMarkerCountLocator(page);
  await expect(chart).toBeVisible();

  // Initially promo is off
  const offCount = Number(await chart.getAttribute('data-promo-marker-count')) || 0;

  // Toggle on
  await page.getByTestId('promo-overlay-toggle').click();
  await page.waitForURL(/promo=1/);
  await expect(chart).toHaveAttribute('data-promo-marker-count', /\d+/);
  const onCount = Number(await chart.getAttribute('data-promo-marker-count')) || 0;

  // Should increase or at least be non-zero when overlay is on
  expect(onCount).toBeGreaterThan(0);
  // And should differ from off state
  expect(onCount).not.toBe(offCount);

  // Toggle off -> should return to zero
  await page.getByTestId('promo-overlay-toggle').click();
  await page.waitForURL((url) => !url.toString().includes('promo=1'));
  await expect(chart).toHaveAttribute('data-promo-marker-count', /^0$/);
});

// Live mode: choose a promo week where week.startOfISOWeek falls within a demo promo window.
// 2025-08-17 (Sun) has startOfISOWeek 2025-08-11 (Mon), which is within 2025-08-10..2025-08-16.
// We expect trend markers > 0 and facts rows to be highlighted when promo overlay is on.
test('Promo overlay (Live) highlights facts rows and shows trend markers', async ({ page }) => {
  await setDemoCookie(page, false);
  await ensureDbOrSkip(page);

  const weekEndStr = '2025-08-17';

  // Cleanup any prior data
  await cleanupWeekFacts(page, weekEndStr, ['0001', '0002']);

  // Ingest minimal store totals so facts render
  await ingestStoreTotals(page, weekEndStr, [
    { storeCode: '0001', storeName: 'Store #0001', units: 1000, revenue: 100000 },
    { storeCode: '0002', storeName: 'Store #0002', units: 500, revenue: 50000 },
  ]);

  // Navigate with promo ON and larger facts limit to ensure visibility
  await page.goto(`/?week=${encodeURIComponent(weekEndStr)}&promo=1&factsLimit=500`);

  const panel = getFactsPanel(page);
  await expect(panel).toBeVisible();

  // Verify at least one row exists
  const rows = panel.getByTestId('facts-row');
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  expect(total).toBeGreaterThan(0);

  // With promo ON and no skuUpcs in demo data, the page falls back to highlightAll for promo weeks
  // -> all rows should be highlighted
  const highlighted = await panel.locator('[data-testid="facts-row"][data-promo-highlight="true"]').count();
  expect(highlighted).toBe(total);

  // Trend chart should also show at least one promo marker for this week
  const chart = getTrendMarkerCountLocator(page);
  await expect(chart).toBeVisible();
  const onCount = Number(await chart.getAttribute('data-promo-marker-count')) || 0;
  expect(onCount).toBeGreaterThan(0);

  // Toggle promo OFF -> markers go to zero and rows are not highlighted
  await page.getByTestId('promo-overlay-toggle').click();
  await page.waitForURL((url) => !url.toString().includes('promo=1'));
  await expect(chart).toHaveAttribute('data-promo-marker-count', /^0$/);
  const highlightedAfterOff = await panel.locator('[data-testid="facts-row"][data-promo-highlight="true"]').count();
  expect(highlightedAfterOff).toBe(0);
});
