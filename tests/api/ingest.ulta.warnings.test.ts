import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer } from '../helpers/testServer';
import * as XLSX from 'xlsx';

const HAS_DB = !!process.env.DATABASE_URL;

// Choose a week-end date (Sunday) near now to avoid collisions
function nextSunday(from: Date): Date {
  const day = from.getDay(); // 0 = Sun
  const delta = (7 - day) % 7; // days until Sunday (0 if already Sunday)
  const ret = new Date(from);
  ret.setDate(from.getDate() + delta);
  ret.setHours(0, 0, 0, 0);
  return ret;
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

(HAS_DB ? describe : describe.skip)('POST /api/ingest/ulta warnings (no allocator)', () => {
  let server: ReturnType<typeof createServer> | undefined;
  const weekEndStr = nextSunday(new Date()).toISOString().slice(0, 10);

  beforeAll(async () => {
    process.env.DEMO_MODE = 'false';
    process.env.USE_DB = 'true';
    server = createServer();
    await new Promise<void>((resolve) => server!.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  });

  it('returns warnings indicating pseudo-UPC fallback', async () => {
    const storeBuf = makeStoreSalesXlsx([
      { storeCode: '0101', storeName: 'Store #0101', units: 10, revenue: 100 },
    ]);

    const res = await request(server!)
      .post('/api/ingest/ulta')
      .set('Cookie', 'piq_demo_mode=false')
      .field('weekEndDate', weekEndStr)
      .attach('file', storeBuf, 'Store-Sales_WARN.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.warnings)).toBe(true);
    const msg = res.body.warnings.join('\n');
    expect(msg).toMatch(/No Sales_Inv_Perf workbook detected/);
  });
});
