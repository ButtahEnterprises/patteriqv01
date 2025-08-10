import { describe, it, expect, beforeAll } from 'vitest';

function req(url: string, cookieDemo?: boolean) {
  const headers = new Headers();
  if (cookieDemo !== undefined) headers.set('cookie', `piq_demo_mode=${cookieDemo}`);
  return new Request(url, { headers });
}

function isNonEmptyArray<T>(v: unknown): v is T[] {
  return Array.isArray(v);
}

function isSortedDesc(nums: number[]): boolean {
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] < nums[i + 1]) return false;
  }
  return true;
}

beforeAll(() => {
  // Keep DB off in unit tests; APIs must still behave in both modes
  process.env.DEMO_MODE = 'true';
  process.env.USE_DB = 'false';
});

describe('Leaderboards API', () => {
  const limit = 5;

  async function runTopProducts(by: 'units' | 'revenue', cookieDemo: boolean) {
    const { GET: getTopProducts } = await import('../../src/app/api/leaderboards/top-products/route');
    const res = await getTopProducts(req(`http://test.local/api/leaderboards/top-products?by=${by}&limit=${limit}`, cookieDemo));
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type') || '').toContain('application/json');
    const body = await res.json();
    expect(isNonEmptyArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(limit);
    if (cookieDemo) expect(body.length).toBeGreaterThan(0); // demo should be populated

    if (body.length > 0) {
      const first = body[0];
      expect(first).toHaveProperty('skuId');
      expect(first).toHaveProperty('skuName');
      expect(first).toHaveProperty('revenue');
      expect(first).toHaveProperty('units');
      const vals = (body as Array<{ revenue: number; units: number }>).map((x) => (by === 'units' ? Number(x.units) : Number(x.revenue)));
      expect(isSortedDesc(vals)).toBe(true);
      // Log one sample for read-through
      // eslint-disable-next-line no-console
      console.log(`[LEADERBOARDS][products][demo=${cookieDemo}][by=${by}] sample=`, body[0]);
    }
  }

  async function runTopStores(cookieDemo: boolean) {
    const { GET: getTopStores } = await import('../../src/app/api/leaderboards/top-stores/route');
    const res = await getTopStores(req(`http://test.local/api/leaderboards/top-stores?limit=${limit}`, cookieDemo));
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type') || '').toContain('application/json');
    const body = await res.json();
    expect(isNonEmptyArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(limit);
    if (cookieDemo) expect(body.length).toBeGreaterThan(0);

    if (body.length > 0) {
      const first = body[0];
      expect(first).toHaveProperty('storeId');
      expect(first).toHaveProperty('storeName');
      expect(first).toHaveProperty('revenue');
      expect(first).toHaveProperty('units');
      const vals = (body as Array<{ revenue: number }>).map((x) => Number(x.revenue));
      expect(isSortedDesc(vals)).toBe(true);
      // eslint-disable-next-line no-console
      console.log(`[LEADERBOARDS][stores][demo=${cookieDemo}] sample=`, body[0]);
    }
  }

  it('GET /api/leaderboards/top-products?by=units&limit=5 (demo & live)', async () => {
    await runTopProducts('units', true);
    await runTopProducts('units', false);
  });

  it('GET /api/leaderboards/top-products?by=revenue&limit=5 (demo & live)', async () => {
    await runTopProducts('revenue', true);
    await runTopProducts('revenue', false);
  });

  it('GET /api/leaderboards/top-stores?limit=5 (demo & live)', async () => {
    await runTopStores(true);
    await runTopStores(false);
  });
});

describe('Leaderboards API - edge cases', () => {
  const limit = 5;

  it("invalid 'by' defaults to units (demo & live)", async () => {
    const { GET: getTopProducts } = await import('../../src/app/api/leaderboards/top-products/route');
    // demo
    let res = await getTopProducts(req(`http://test.local/api/leaderboards/top-products?by=invalid&limit=${limit}`, true));
    expect(res.ok).toBe(true);
    let body = (await res.json()) as Array<{ units: number; revenue: number }>;
    if (Array.isArray(body) && body.length > 1) {
      const unitsVals = body.map((x) => Number(x.units));
      expect(isSortedDesc(unitsVals)).toBe(true);
    }

    // live
    res = await getTopProducts(req(`http://test.local/api/leaderboards/top-products?by=invalid&limit=${limit}`, false));
    expect(res.ok).toBe(true);
    body = (await res.json()) as Array<{ units: number; revenue: number }>;
    if (Array.isArray(body) && body.length > 1) {
      const unitsVals = body.map((x) => Number(x.units));
      expect(isSortedDesc(unitsVals)).toBe(true);
    }
  });

  it('limit clamps to [1,20] for products (demo only)', async () => {
    const { GET: getTopProducts } = await import('../../src/app/api/leaderboards/top-products/route');
    // limit too low -> 1
    let res = await getTopProducts(req('http://test.local/api/leaderboards/top-products?by=units&limit=0', true));
    let body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    // limit too high -> 20
    res = await getTopProducts(req('http://test.local/api/leaderboards/top-products?by=units&limit=999', true));
    body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(20);

    // nominal 5
    res = await getTopProducts(req('http://test.local/api/leaderboards/top-products?by=units&limit=5', true));
    body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(5);
  });

  it('limit clamps to [1,20] for stores (demo only)', async () => {
    const { GET: getTopStores } = await import('../../src/app/api/leaderboards/top-stores/route');
    // limit too low -> 1
    let res = await getTopStores(req('http://test.local/api/leaderboards/top-stores?limit=0', true));
    let body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    // limit too high -> 20
    res = await getTopStores(req('http://test.local/api/leaderboards/top-stores?limit=999', true));
    body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(20);
  });

  it('field types look correct for first item (demo only)', async () => {
    const { GET: getTopProducts } = await import('../../src/app/api/leaderboards/top-products/route');
    const { GET: getTopStores } = await import('../../src/app/api/leaderboards/top-stores/route');

    const resP = await getTopProducts(req('http://test.local/api/leaderboards/top-products?by=revenue&limit=5', true));
    const arrP = (await resP.json()) as Array<any>;
    if (arrP.length) {
      const f = arrP[0];
      expect(typeof f.skuId).toBe('number');
      expect(typeof f.skuName).toBe('string');
      expect(typeof f.revenue).toBe('number');
      expect(typeof f.units).toBe('number');
    }

    const resS = await getTopStores(req('http://test.local/api/leaderboards/top-stores?limit=5', true));
    const arrS = (await resS.json()) as Array<any>;
    if (arrS.length) {
      const f = arrS[0];
      expect(typeof f.storeId).toBe('number');
      expect(typeof f.storeName).toBe('string');
      expect(typeof f.revenue).toBe('number');
      expect(typeof f.units).toBe('number');
    }
  });
});
