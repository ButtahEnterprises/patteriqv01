import { test, expect } from '@playwright/test';
import type { Page, APIResponse } from '@playwright/test';
import * as XLSX from 'xlsx';

function baseURL() {
  return test.info().project.use.baseURL || 'http://localhost:3000';
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

async function setDemoCookie(page: Page, value: boolean) {
  await page.context().addCookies([
    { name: 'piq_demo_mode', value: String(value), url: baseURL() },
  ]);
}

function nextSunday(from: Date): Date {
  const day = from.getDay();
  const delta = (7 - day) % 7; // days until Sunday (0 if already Sunday)
  const ret = new Date(from);
  ret.setDate(from.getDate() + delta);
  ret.setHours(0, 0, 0, 0);
  return ret;
}

function fmtDateYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
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

function makeAllocatorXlsx(skus: Array<{ upc: string; name?: string; units?: number; revenue?: number }>): Buffer {
  const aoa: any[][] = [];
  aoa.push(['Some Header']);
  aoa.push([]);
  aoa.push(['UPC', 'ULTA Item Description', 'Sales TY Units', 'Sales TY $$']);
  for (const s of skus) aoa.push([s.upc, s.name || `SKU ${s.upc}`, s.units ?? 0, s.revenue ?? 0]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Last Closed Week');
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
    test.skip(true, 'Database not available. Skipping Live ingestion tests.');
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

async function ingestWithAllocator(page: Page, weekEndStr: string, storeRow: { storeCode: string; storeName: string; units: number; revenue: number }, allocSkus: Array<{ upc: string; name?: string; units?: number; revenue?: number }>) {
  const storeBuf = makeStoreSalesXlsx([storeRow]);
  const allocBufA = makeAllocatorXlsx(allocSkus);
  const allocBufB = makeAllocatorXlsx([{ upc: '333333', name: 'SKU 333', units: 100, revenue: 1000 }]);

  const payload = {
    weekEndStr,
    files: [
      { name: 'Store-Sales_DEF.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64: storeBuf.toString('base64') },
      { name: 'Sales_Inv_Perf__Brand.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64: allocBufA.toString('base64') },
      { name: 'Sales_Inv_Perf__Extra.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64: allocBufB.toString('base64') },
    ],
    url: baseURL() + '/api/ingest/ulta',
  } as const;

  const result = await page.evaluate(async (p) => {
    function b64ToUint8(b64: string) {
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    const form = new FormData();
    form.append('weekEndDate', p.weekEndStr);
    for (const f of p.files) {
      const bytes = b64ToUint8(f.b64);
      // File constructor is supported in modern browsers
      const file = new File([bytes], f.name, { type: f.type });
      form.append('file', file);
    }
    const resp = await fetch(p.url, { method: 'POST', body: form });
    let json: any = null;
    try { json = await resp.json(); } catch {}
    return { status: resp.status, ok: resp.ok, json };
  }, payload);

  expect(result.status).toBe(200);
  expect(result.ok).toBeTruthy();
  expect(result.json?.ok).toBe(true);
}

function currencyToNumber(s: string): number {
  const m = s.replace(/[^0-9.-]/g, '');
  const n = Number(m);
  return isFinite(n) ? n : 0;
}

test.describe('Weekly Sales — Facts', () => {
  test('Demo mode shows badge and empty state', async ({ page }) => {
    await setDemoCookie(page, true);
    await page.goto('/?week=latest&factsLimit=500');
    const panel = page.getByTestId('weekly-facts');
    await expect(panel).toBeVisible();
    const badge = panel.getByTestId('facts-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-mode', 'demo');
    await expect(panel.getByTestId('facts-empty')).toBeVisible();
    await expect(panel.getByTestId('facts-row')).toHaveCount(0);
  });

  test('Live mode renders facts after ingestion, sorts by revenue, and honors allocator', async ({ page }) => {
    await setDemoCookie(page, false);
    await ensureDbOrSkip(page);

    // Use next week's Sunday to avoid idempotent inserts from previous runs for the same week
    const weekEnd = nextSunday(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const weekEndStr = fmtDateYYYYMMDD(weekEnd);

    // Cleanup any prior data for these stores for this week to avoid collisions
    await cleanupWeekFacts(page, weekEndStr, ['0001', '0002', '0003']);

    // Ingest store totals (no allocator) → pseudo SKU ALL
    await ingestStoreTotals(page, weekEndStr, [
      { storeCode: '0001', storeName: 'Store #0001', units: 100, revenue: 1000 },
      { storeCode: '0002', storeName: 'Store #0002', units: 50, revenue: 500 },
    ]);

    await page.goto(`/?week=${encodeURIComponent(weekEndStr)}&factsLimit=500`);
    const panel = page.getByTestId('weekly-facts');
    await expect(panel).toBeVisible();
    const badge = panel.getByTestId('facts-badge');
    await expect(badge).toHaveAttribute('data-mode', 'live');

    const rows = panel.locator('[data-testid="facts-row"]');
    await expect(rows.first()).toBeVisible();

    // Validate some known values exist
    const allUpcCount = await panel.locator('[data-testid="upc"]:has-text("ALL")').count();
    expect(allUpcCount).toBeGreaterThan(0);
    const store0001 = await panel.locator('[data-testid="store-code"]:has-text("0001")').count();
    const store0002 = await panel.locator('[data-testid="store-code"]:has-text("0002")').count();
    expect(store0001).toBeGreaterThan(0);
    expect(store0002).toBeGreaterThan(0);

    // Check sorting by revenue (descending)
    const rowCount = await rows.count();
    if (rowCount > 1) {
      const firstRevText = await rows.nth(0).getByTestId('revenue').innerText();
      const secondRevText = await rows.nth(1).getByTestId('revenue').innerText();
      expect(currencyToNumber(firstRevText)).toBeGreaterThanOrEqual(currencyToNumber(secondRevText));
    }

    // Ingest with allocator for a new store → should show real SKUs and no pseudo ALL for that store
    // Use very large revenue to ensure these SKUs appear in the top-50 facts list across the entire dataset
    await ingestWithAllocator(page, weekEndStr, { storeCode: '0003', storeName: 'Store #0003', units: 2000000, revenue: 2000000 }, [
      { upc: '111111', name: 'SKU 111', units: 60, revenue: 600 },
      { upc: '222222', name: 'SKU 222', units: 40, revenue: 400 },
    ]);

    // Refresh to get the latest week facts
    await page.goto(`/?week=${encodeURIComponent(weekEndStr)}&factsLimit=500`);
    await expect(panel).toBeVisible();

    const rowsAfter = panel.getByTestId('facts-row');
    await expect(rowsAfter.first()).toBeVisible();
    const row0003 = rowsAfter.filter({ has: page.getByTestId('store-code').getByText(/^0003$/) });
    const upcTexts = await row0003.locator('[data-testid="upc"]').allInnerTexts();
    const has111111 = upcTexts.some(t => /111111/.test(t));
    const has222222 = upcTexts.some(t => /222222/.test(t));
    const hasALL = upcTexts.some(t => /ALL/.test(t));
    expect(has111111).toBeTruthy();
    expect(has222222).toBeTruthy();
    expect(hasALL).toBeFalsy();
  });

  test('Toggles Demo/Live in same session updates panel state', async ({ page }) => {
    // Start Live and ensure DB available; minimal ingest to have something to show
    await setDemoCookie(page, false);
    await ensureDbOrSkip(page);
    const weekEnd = nextSunday(new Date());
    const weekEndStr = fmtDateYYYYMMDD(weekEnd);
    await cleanupWeekFacts(page, weekEndStr, ['0100']);
    await ingestStoreTotals(page, weekEndStr, [
      { storeCode: '0100', storeName: 'Store #0100', units: 10, revenue: 100 },
    ]);

    await page.goto(`/?week=${encodeURIComponent(weekEndStr)}&factsLimit=500`);
    const panel = page.getByTestId('weekly-facts');
    await expect(panel.getByTestId('facts-badge')).toHaveAttribute('data-mode', 'live');
    await expect(panel.getByTestId('facts-row').first()).toBeVisible();

    // Switch to Demo
    await setDemoCookie(page, true);
    await page.reload();
    await expect(panel.getByTestId('facts-badge')).toHaveAttribute('data-mode', 'demo');
    await expect(panel.getByTestId('facts-empty')).toBeVisible();

    // Switch back to Live
    await setDemoCookie(page, false);
    await page.reload();
    await expect(panel.getByTestId('facts-badge')).toHaveAttribute('data-mode', 'live');
    await expect(panel.getByTestId('facts-row').first()).toBeVisible();
  });
});
