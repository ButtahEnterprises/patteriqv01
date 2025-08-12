import request from 'supertest';
import { beforeAll, afterAll, describe, test, expect, it } from 'vitest';
import { createServer } from './helpers/testServer';
import prisma from '../lib/prisma';
import { GET as trendGET } from '../src/app/api/kpi/trend/route';
import { GET as storesAtRiskGET } from '../src/app/api/stores-at-risk/route';

// --- Add near the other imports ---
import { GET as dataHealthGET } from '../src/app/api/data-health/route';

// --- Inside your API smoke tests describe block ---
it('GET /api/data-health (Demo & Live) → array length >= 8 and correct shape', async () => {
  const modes: Array<[string, string]> = [
    ['Demo', 'piq_demo_mode=true'],
    ['Live', 'piq_demo_mode=false'],
  ];

  for (const [label, cookie] of modes) {
    const req = new Request('http://localhost/api/data-health?weeks=12', {
      headers: { cookie },
    });

    const res = await dataHealthGET(req);
    expect(res.ok).toBe(true);
    const json = await res.json();

    expect(Array.isArray(json)).toBe(true);

    // In Demo mode we may get synthetic data, so just validate shape when non-empty
    if (json.length > 0) {
      expect(json.length).toBeGreaterThanOrEqual(8);
      for (const item of json) {
        expect(typeof item.isoWeek).toBe('string');
        expect(typeof item.totalStores).toBe('number');
        expect(typeof item.pseudoStores).toBe('number');
        expect(typeof item.pctFullAllocated).toBe('number');
      }

      // Check ascending isoWeek order
      const weeks = json.map(r => r.isoWeek);
      const isoToNum = (w: string) => {
        const [year, wk] = w.split('-W').map(Number);
        return year * 100 + wk;
      };
      const sorted = [...weeks].sort((a, b) => isoToNum(a) - isoToNum(b));
      expect(weeks).toEqual(sorted);
    }

    console.log(
      `[SMOKE] /api/data-health ${label} mode → length=${json.length}, sample=`,
      json[0]
    );
  }
});


let server: ReturnType<typeof createServer>;

async function callApi(
  handler: (req: Request) => Promise<Response> | Response,
  path: string,
  cookies?: Record<string, string>,
) {
  const headers = new Headers();
  if (cookies && Object.keys(cookies).length) {
    headers.set(
      'Cookie',
      Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    );
  }
  const req = new Request(`http://localhost${path}`, { headers });
  const res = await handler(req);
  return res.json();
}

function parseIsoWeekKey(iso: string): number {
  const m = iso.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return Number.NaN;
  return Number(m[1]) * 100 + Number(m[2]);
}

function isAscendingIsoWeeks(values: string[]): boolean {
  let prev: number | undefined;
  for (const v of values) {
    const k = parseIsoWeekKey(v);
    if (!Number.isFinite(k)) return false;
    if (prev !== undefined && k < prev) return false;
    prev = k;
  }
  return true;
}

beforeAll(async () => {
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect().catch(() => {});
});

describe('API smoke tests', () => {
  test('GET /api/health → db.up === true and latencyMs is number', async () => {
    const res = await request(server)
      .get('/api/health')
      .set('Cookie', 'piq_demo_mode=false')
      .expect(200);
    const body = res.body;

    expect(body && typeof body === 'object').toBe(true);
    expect(body.ok).toBe(true);
    expect(body.db && typeof body.db === 'object').toBe(true);
    if (body.db.skipped) {
      // When USE_DB is disabled or in demo, DB check is skipped
      expect(body.db.up).toBe(false);
      expect(body.db.latencyMs).toBe(null);
    } else {
      expect(body.db.up).toBe(true);
      expect(typeof body.db.latencyMs).toBe('number');
    }
  });

  test('GET /api/weekly-summary → returns week string and kpis array', async () => {
    const res = await request(server).get('/api/weekly-summary').expect(200);
    const body = res.body;

    expect(body && typeof body === 'object').toBe(true);
    expect(typeof body.week).toBe('string');
    expect(Array.isArray(body.kpis)).toBe(true);
  });

  test('GET /api/kpi/trend (Demo & Live) → array length >= 8 and ascending isoWeek when present', async () => {
    // Demo mode
    const demoArr = (await callApi(trendGET, '/api/kpi/trend?weeks=8', { piq_demo_mode: 'true' })) as any[];
    expect(Array.isArray(demoArr)).toBe(true);
    if (demoArr.length > 0) {
      expect(demoArr.length).toBeGreaterThanOrEqual(8);
      const weeks = demoArr.map((x: any) => x.isoWeek);
      expect(isAscendingIsoWeeks(weeks)).toBe(true);
      expect(typeof demoArr[0].isoWeek).toBe('string');
      expect(typeof demoArr[0].revenue === 'number' || typeof demoArr[0].revenue === 'string').toBe(true);
      expect(typeof demoArr[0].units).toBe('number');
    }

    // Live mode
    const liveArr = (await callApi(trendGET, '/api/kpi/trend?weeks=8', { piq_demo_mode: 'false' })) as any[];
    expect(Array.isArray(liveArr)).toBe(true);
    if (liveArr.length > 0) {
      expect(liveArr.length).toBeGreaterThanOrEqual(8);
      const weeks = liveArr.map((x: any) => x.isoWeek);
      expect(isAscendingIsoWeeks(weeks)).toBe(true);
      expect(typeof liveArr[0].isoWeek).toBe('string');
      expect(typeof liveArr[0].revenue === 'number' || typeof liveArr[0].revenue === 'string').toBe(true);
      expect(typeof liveArr[0].units).toBe('number');
    }
  });

  test('GET /api/stores-at-risk (Demo & Live) → <= 10 items; each has { storeId, storeName, zScore:number, pctChange:number }', async () => {
    const check = (arr: any[]) => {
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBeLessThanOrEqual(10);
      if (arr.length > 0) {
        expect(typeof arr[0].storeId).toBe('number');
        expect(typeof arr[0].storeName).toBe('string');
        expect(typeof arr[0].zScore).toBe('number');
        expect(typeof arr[0].pctChange).toBe('number');
      }
    };

    // Demo mode (may be empty)
    const demoArr = await callApi(storesAtRiskGET, '/api/stores-at-risk', { piq_demo_mode: 'true' });
    check(demoArr);

    // Live mode (should be populated when ingest is complete)
    const liveArr = await callApi(storesAtRiskGET, '/api/stores-at-risk', { piq_demo_mode: 'false' });
    check(liveArr);
  });

  test('GET /api/stores/:id/trend (Demo & Live) → array of { isoWeek, revenue, units }', async () => {
    // Demo
    const demo = await request(server)
      .get('/api/stores/101/trend?weeks=8')
      .set('Cookie', 'piq_demo_mode=true')
      .expect(200);
    const d = demo.body as any[];
    expect(Array.isArray(d)).toBe(true);
    if (d.length > 0) {
      expect(typeof d[0].isoWeek).toBe('string');
      expect(typeof d[0].revenue === 'number' || typeof d[0].revenue === 'string').toBe(true);
      expect(typeof d[0].units).toBe('number');
    }

    // Live — pick a storeId from stores-at-risk if available
    const liveStores = (await callApi(storesAtRiskGET, '/api/stores-at-risk', { piq_demo_mode: 'false' })) as any[];
    const sid = liveStores[0]?.storeId ?? 1;
    const live = await request(server)
      .get(`/api/stores/${sid}/trend?weeks=8`)
      .set('Cookie', 'piq_demo_mode=false')
      .expect(200);
    const l = live.body as any[];
    expect(Array.isArray(l)).toBe(true);
  });

  test('GET /api/stores/:id/sku-breakdown (Demo & Live) → object with items[]', async () => {
    // Demo
    const demo = await request(server)
      .get('/api/stores/101/sku-breakdown?week=latest')
      .set('Cookie', 'piq_demo_mode=true')
      .expect(200);
    const d = demo.body as any;
    expect(d && typeof d === 'object').toBe(true);
    expect(Array.isArray(d.items)).toBe(true);

    // Live — pick a storeId from stores-at-risk if available
    const liveStores = (await callApi(storesAtRiskGET, '/api/stores-at-risk', { piq_demo_mode: 'false' })) as any[];
    const sid = liveStores[0]?.storeId ?? 1;
    const live = await request(server)
      .get(`/api/stores/${sid}/sku-breakdown?week=latest`)
      .set('Cookie', 'piq_demo_mode=false')
      .expect(200);
    const l = live.body as any;
    expect(l && typeof l === 'object').toBe(true);
    expect(Array.isArray(l.items)).toBe(true);
  });
});
