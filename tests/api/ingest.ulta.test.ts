import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer } from '../helpers/testServer';
import * as XLSX from 'xlsx';

const HAS_DB = !!process.env.DATABASE_URL;
const d = new Date();
// Choose a week-end date (Sunday) near now to avoid collisions
function nextSunday(from: Date): Date {
  const day = from.getDay(); // 0 = Sun
  const delta = (7 - day) % 7; // days until Sunday (0 if already Sunday)
  const ret = new Date(from);
  ret.setDate(from.getDate() + delta);
  ret.setHours(0, 0, 0, 0);
  return ret;
}
const weekEnd = nextSunday(d);
const weekEndStr = weekEnd.toISOString().slice(0, 10);

function makeStoreSalesXlsx(rows: Array<{ storeCode: string; storeName: string; units: number; revenue: number }>): Buffer {
  const aoa: any[][] = [];
  // Add a couple of pre-header lines to simulate real files
  aoa.push(['ULTRA REPORT']);
  aoa.push(['Generated', new Date().toISOString()]);
  // Header that parser recognizes
  aoa.push(['Store Number', 'Store Name', 'Sales Units', 'Net Sales']);
  for (const r of rows) {
    aoa.push([r.storeCode, r.storeName, r.units, r.revenue]);
  }
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
  // Header row recognizable by parser
  aoa.push(['UPC', 'ULTA Item Description', 'Sales TY Units', 'Sales TY $$']);
  for (const s of skus) {
    aoa.push([s.upc, s.name || `SKU ${s.upc}`, s.units ?? 0, s.revenue ?? 0]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Last Closed Week');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as any);
}

let server: ReturnType<typeof createServer> | undefined;

(HAS_DB ? describe : describe.skip)('POST /api/ingest/ulta', () => {
  beforeAll(async () => {
    process.env.DEMO_MODE = 'false';
    process.env.USE_DB = 'true';
    server = createServer();
    await new Promise<void>((resolve) => server!.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  });

  it('fails with 400 when no Store-Sales files provided', async () => {
    const res = await request(server!)
      .post('/api/ingest/ulta')
      .set('Cookie', 'piq_demo_mode=false')
      .field('weekEndDate', weekEndStr)
      .attach('file', Buffer.from('not-an-xlsx'), 'notes.txt');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(String(res.body.error || '')).toMatch(/No Store-Sales files/i);
  });

  it('ingests store totals without allocator (fallback to pseudo-SKU)', async () => {
    const storeBuf = makeStoreSalesXlsx([
      { storeCode: '0001', storeName: 'Store #0001', units: 100, revenue: 1000 },
      { storeCode: '0002', storeName: 'Store #0002', units: 50, revenue: 500 },
    ]);

    const res = await request(server!)
      .post('/api/ingest/ulta')
      .set('Cookie', 'piq_demo_mode=false')
      .field('weekEndDate', weekEndStr)
      .attach('file', storeBuf, 'Store-Sales_ABC.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.files).toBe(1);
    expect(res.body.rows).toBeGreaterThanOrEqual(2); // pseudo-SKU per store
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details[0].kind).toBe('store-totals');

    // Verify facts are queryable
    const summary = await request(server!)
      .get(`/api/weekly-summary?view=facts&week=${weekEndStr}`)
      .set('Cookie', 'piq_demo_mode=false');
    expect(summary.status).toBe(200);
    const body = summary.body as { week: string; items: any[] };
    expect(body.week).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    // Should include at least our two stores (pseudo SKU ALL)
    const allUpcs = new Set(body.items.map((i: any) => i.upc));
    expect(allUpcs.has('ALL')).toBe(true);
  });

  it('ingests with allocator and ignores additional allocator files; then idempotent on re-run', async () => {
    const storeBuf = makeStoreSalesXlsx([
      { storeCode: '0003', storeName: 'Store #0003', units: 200, revenue: 2000 },
    ]);
    const allocBufA = makeAllocatorXlsx([
      { upc: '111111', name: 'SKU 111', units: 60, revenue: 600 },
      { upc: '222222', name: 'SKU 222', units: 40, revenue: 400 },
    ]);
    const allocBufB = makeAllocatorXlsx([
      { upc: '333333', name: 'SKU 333', units: 100, revenue: 1000 },
    ]);

    const doPost = async () =>
      request(server!)
        .post('/api/ingest/ulta')
        .set('Cookie', 'piq_demo_mode=false')
        .field('weekEndDate', weekEndStr)
        .attach('file', storeBuf, 'Store-Sales_DEF.xlsx')
        .attach('file', allocBufA, 'Sales_Inv_Perf__Brand.xlsx')
        .attach('file', allocBufB, 'Sales_Inv_Perf__Extra.xlsx');

    const first = await doPost();
    expect(first.status).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(first.body.rows).toBeGreaterThanOrEqual(2); // 2 SKUs allocated
    const kinds = first.body.details.map((d: any) => d.kind);
    expect(kinds).toContain('store-totals');
    expect(kinds).toContain('allocator');
    expect(kinds).toContain('ignored');

    // Re-run with same payload should be idempotent
    const second = await doPost();
    expect(second.status).toBe(200);
    expect(second.body.ok).toBe(true);
    // No new rows inserted
    expect(Number(second.body.inserted)).toBe(0);

    // Facts reflect SKUs (no pseudo ALL)
    const facts = await request(server!)
      .get(`/api/weekly-summary?view=facts&week=${weekEndStr}`)
      .set('Cookie', 'piq_demo_mode=false');
    expect(facts.status).toBe(200);
    const items: any[] = facts.body.items || [];
    const upcs = new Set(items.filter(i => i.storeCode === '0003').map(i => i.upc));
    expect(upcs.has('111111')).toBe(true);
    expect(upcs.has('222222')).toBe(true);
    expect(upcs.has('ALL')).toBe(false);
  });
});
